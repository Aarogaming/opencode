import { compatible, parseInvoke, parseResult } from "./interop"
import { createHmac } from "node:crypto"

function rid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

type auth = {
  hdr?: string
  token?: string
  key?: string
  api_hdr?: string
  api_token?: string
}

type hello = {
  ok?: boolean
  auth?: {
    required?: boolean
    header?: string
    bearer?: boolean
  }
  endpoints?: {
    invoke?: string
  }
}

const cache = new Map<string, hello | null>()

function url(raw: string) {
  return new URL(raw).toString()
}

function join(base: string, rel?: string) {
  if (!rel) return base
  return new URL(rel, base).toString()
}

function hdr(input: { auth?: auth; json: string; hint?: hello; stamp?: string; sign?: boolean }) {
  const out: Record<string, string> = {
    "content-type": "application/json",
  }
  const token = input.auth?.token
  const key = input.auth?.key
  const name = input.auth?.hdr ?? input.hint?.auth?.header ?? "x-aas-bridge-token"
  const api = input.auth?.api_token
  const apiHdr = input.auth?.api_hdr ?? "x-aas-token"

  if (token) out[name] = token
  if (token && !input.auth?.hdr && input.hint?.auth?.bearer)
    out.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`
  if (api) out[apiHdr] = api

  if (key && input.sign !== false) {
    const stamp = input.stamp ?? Date.now().toString()
    const sig = createHmac("sha256", key).update(`${stamp}.${input.json}`).digest("hex")
    out["x-aas-timestamp"] = stamp
    out["x-aas-signature"] = sig
  }
  return out
}

async function hello(input: { bridge: string; auth?: auth; timeout: number }) {
  const base = url(input.bridge)
  if (cache.has(base)) return cache.get(base)

  const hand = base.endsWith("/invoke")
    ? `${base.slice(0, -"/invoke".length)}/handshake`
    : `${base.replace(/\/$/, "")}/handshake`
  const probe = JSON.stringify({ probe: true })
  const ctrl = new AbortController()
  const wait = setTimeout(() => ctrl.abort(), input.timeout)

  try {
    const first = await fetch(hand, {
      method: "GET",
      headers: hdr({ auth: input.auth, json: probe, sign: false }),
      signal: ctrl.signal,
    }).catch(() => undefined)

    if (first?.ok) {
      const out = (await first.json().catch(() => undefined)) as hello | undefined
      cache.set(base, out ?? null)
      return out ?? null
    }

    if (!input.auth?.token || input.auth?.hdr) {
      cache.set(base, null)
      return null
    }

    const second = await fetch(hand, {
      method: "GET",
      headers: {
        "x-aas-bridge-token": input.auth.token,
        authorization: input.auth.token.startsWith("Bearer ") ? input.auth.token : `Bearer ${input.auth.token}`,
      },
      signal: ctrl.signal,
    }).catch(() => undefined)

    if (!second?.ok) {
      cache.set(base, null)
      return null
    }
    const out = (await second.json().catch(() => undefined)) as hello | undefined
    cache.set(base, out ?? null)
    return out ?? null
  } finally {
    clearTimeout(wait)
  }
}

export async function call(input: {
  bridge: string
  capability: string
  mode: "offline" | "hybrid" | "live"
  payload: Record<string, unknown>
  timeout?: number
  auth?: auth
}) {
  const request_id = rid()
  const operation_id = rid()
  const started = Date.now()

  const ctrl = new AbortController()
  const timeout = input.timeout ?? 20_000
  const wait = setTimeout(() => ctrl.abort(), timeout)
  const meta = await hello({ bridge: input.bridge, auth: input.auth, timeout: Math.min(timeout, 3000) }).catch(
    () => null,
  )
  const bridge = join(input.bridge, meta?.endpoints?.invoke)
  const rpc = parseInvoke({
    command: "capability.invoke",
    request_id,
    operation_id,
    capability: input.capability,
    args: input.payload,
    mode: input.mode,
    protocol_version: "1.0",
  })
  const json = JSON.stringify(rpc)
  const head = hdr({ auth: input.auth, json, hint: meta ?? undefined })

  const fail = (
    code: "bad_response" | "upstream_timeout" | "upstream_unavailable" | "internal_error",
    message: string,
  ) => ({
    ok: false as const,
    request_id,
    operation_id,
    capability: input.capability,
    error: {
      code,
      message,
      retryable: code === "upstream_timeout" || code === "upstream_unavailable",
    },
    latency_ms: Date.now() - started,
    finished_at_utc: new Date().toISOString(),
  })

  try {
    const res = await fetch(bridge, {
      method: "POST",
      headers: head,
      body: json,
      signal: ctrl.signal,
    }).catch((err) => {
      if (err instanceof Error && err.name === "AbortError") return fail("upstream_timeout", "Bridge request timed out")
      return fail("upstream_unavailable", err instanceof Error ? err.message : "Bridge request failed")
    })

    if (!(res instanceof Response)) return res

    if (res.status === 401 && input.auth?.token && !input.auth.hdr) {
      const retry = await fetch(bridge, {
        method: "POST",
        headers: {
          ...head,
          "x-aas-bridge-token": input.auth.token,
          authorization: input.auth.token.startsWith("Bearer ") ? input.auth.token : `Bearer ${input.auth.token}`,
        },
        body: json,
        signal: ctrl.signal,
      }).catch((err) => {
        if (err instanceof Error && err.name === "AbortError")
          return fail("upstream_timeout", "Bridge request timed out")
        return fail("upstream_unavailable", err instanceof Error ? err.message : "Bridge request failed")
      })
      if (!(retry instanceof Response)) return retry
      return parse({
        res: retry,
        fail,
        started,
        request_id,
        operation_id,
        capability: input.capability,
      })
    }

    return parse({
      res,
      fail,
      started,
      request_id,
      operation_id,
      capability: input.capability,
    })
  } finally {
    clearTimeout(wait)
  }
}

async function parse(input: {
  res: Response
  fail: (
    code: "bad_response" | "upstream_timeout" | "upstream_unavailable" | "internal_error",
    message: string,
  ) => {
    ok: false
    request_id: string
    operation_id: string
    capability: string
    error: {
      code: "bad_response" | "upstream_timeout" | "upstream_unavailable" | "internal_error"
      message: string
      retryable: boolean
    }
    latency_ms: number
    finished_at_utc: string
  }
  started: number
  request_id: string
  operation_id: string
  capability: string
}) {
  if (!input.res.ok) {
    const detail = await input.res
      .clone()
      .json()
      .then((x) => (x && typeof x === "object" && "detail" in x ? String((x as Record<string, unknown>).detail) : ""))
      .catch(() => "")
    const msg = detail ? `Bridge returned ${input.res.status}: ${detail}` : `Bridge returned ${input.res.status}`
    if (input.res.status >= 500) return input.fail("upstream_unavailable", msg)
    return input.fail("bad_response", msg)
  }

  const out = await input.res.json().catch(() => undefined)
  const parsed = parseResult(out)
  if (parsed.success) {
    if (parsed.data.protocol_version && !compatible(parsed.data.protocol_version)) {
      return input.fail("bad_response", `Unsupported protocol version ${parsed.data.protocol_version}`)
    }
    return parsed.data
  }

  if (!out || typeof out !== "object") {
    return input.fail("bad_response", "Invalid AAS bridge response")
  }

  const ok = "ok" in out ? Boolean((out as Record<string, unknown>).ok) : false
  if (!ok) {
    const msg = "detail" in out ? String((out as Record<string, unknown>).detail) : "Bridge returned an error"
    return input.fail("bad_response", msg)
  }

  const data = "result" in out ? (out as Record<string, unknown>).result : out
  if (data && typeof data === "object") {
    return {
      ok: true,
      request_id: input.request_id,
      operation_id: input.operation_id,
      capability: input.capability,
      data: data as Record<string, unknown>,
      latency_ms: Date.now() - input.started,
      finished_at_utc: new Date().toISOString(),
    }
  }

  return {
    ok: true,
    request_id: input.request_id,
    operation_id: input.operation_id,
    capability: input.capability,
    data: { value: data },
    latency_ms: Date.now() - input.started,
    finished_at_utc: new Date().toISOString(),
  }
}
