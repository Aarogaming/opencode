import { Config } from "@/config/config"
import { AASInterop } from "./interop"
import { withTimeout } from "@/util/timeout"

export namespace AASDoctor {
  type fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

  export type level = "ok" | "warn" | "fail"

  export type item = {
    key: string
    level: level
    msg: string
  }

  export type report = {
    ok: boolean
    list: item[]
  }

  function url(raw: string) {
    return new URL(raw).toString()
  }

  function probe(raw: string) {
    if (raw.endsWith("/invoke")) return `${raw.slice(0, -"/invoke".length)}/handshake`
    return raw
  }

  function parseVersion(input: unknown) {
    if (!input || typeof input !== "object") return
    if (!("protocol_version" in input)) return
    const value = (input as Record<string, unknown>).protocol_version
    if (typeof value !== "string") return
    return value
  }

  export async function run(
    cfg: Config.Info,
    input?: {
      timeout?: number
      fetcher?: fetcher
    },
  ): Promise<report> {
    const list: item[] = []
    const aas = cfg.aas
    const timeout = input?.timeout ?? 3000
    const fetcher = input?.fetcher ?? fetch

    if (!aas?.enabled) {
      list.push({ key: "aas.enabled", level: "warn", msg: "AAS integration is disabled" })
      return { ok: false, list }
    }

    list.push({ key: "aas.enabled", level: "ok", msg: "AAS integration enabled" })
    list.push({ key: "aas.mode", level: "ok", msg: `Mode is ${aas.mode ?? "offline"}` })

    if (aas.mode === "live" && !aas.bridge?.url) {
      list.push({ key: "aas.bridge", level: "fail", msg: "Bridge URL is required in live mode" })
      return { ok: false, list }
    }

    if (!aas.bridge?.url) {
      list.push({ key: "aas.bridge", level: "warn", msg: "Bridge URL is not configured" })
      return { ok: false, list }
    }

    const base = Promise.resolve(aas.bridge.url)
      .then(url)
      .catch(() => "")

    const hit = await base
    if (!hit) {
      list.push({ key: "aas.bridge", level: "fail", msg: "Bridge URL is invalid" })
      return { ok: false, list }
    }

    list.push({ key: "aas.bridge", level: "ok", msg: `Bridge URL: ${hit}` })

    const target = probe(hit)
    if (target !== hit) list.push({ key: "aas.bridge.probe", level: "ok", msg: `Probe URL: ${target}` })

    const start = Date.now()
    const res = await withTimeout(fetcher(target, { method: "GET" }), timeout)
      .then((res) => ({ ok: true as const, res }))
      .catch((err: unknown) => ({ ok: false as const, err }))

    if (!res.ok) {
      const msg = res.err instanceof Error ? res.err.message : String(res.err)
      list.push({ key: "aas.bridge.reachability", level: "fail", msg: `Bridge probe failed: ${msg}` })
      return { ok: false, list }
    }

    const ms = Date.now() - start
    if (res.res.status >= 500) {
      list.push({ key: "aas.bridge.reachability", level: "fail", msg: `Bridge returned ${res.res.status} in ${ms}ms` })
      return { ok: false, list }
    }

    if (res.res.status >= 400) {
      list.push({
        key: "aas.bridge.reachability",
        level: "warn",
        msg: `Bridge reachable with ${res.res.status} in ${ms}ms`,
      })
    } else {
      list.push({ key: "aas.bridge.reachability", level: "ok", msg: `Bridge reachable in ${ms}ms` })
    }

    const body = await res.res
      .clone()
      .json()
      .catch(() => undefined)

    if (body && typeof body === "object" && "protocol" in body) {
      const protocol = (body as Record<string, unknown>).protocol
      if (typeof protocol === "string" && protocol.includes("aas.opencode.bridge.v1")) {
        list.push({ key: "aas.protocol", level: "ok", msg: `Protocol ${protocol} is compatible` })
      }
      if ("auth" in body) {
        const auth = (body as Record<string, unknown>).auth
        if (
          auth &&
          typeof auth === "object" &&
          "required" in auth &&
          (auth as Record<string, unknown>).required === true
        ) {
          if (!cfg.aas?.auth?.token) {
            list.push({
              key: "aas.auth",
              level: "warn",
              msg: "Bridge requires auth token but aas.auth.token is not configured",
            })
          } else {
            list.push({ key: "aas.auth", level: "ok", msg: "Bridge auth token is configured" })
          }
        }
      }

      if (!cfg.aas?.auth?.api_token) {
        list.push({
          key: "aas.api_auth",
          level: "warn",
          msg: "AAS API token is not configured (may fail if middleware auth is enabled)",
        })
      } else {
        list.push({ key: "aas.api_auth", level: "ok", msg: "AAS API token is configured" })
      }
    }

    const version = parseVersion(body)
    if (!version) {
      list.push({ key: "aas.protocol", level: "warn", msg: "Bridge protocol version not reported" })
      return { ok: list.every((x) => x.level !== "fail"), list }
    }

    if (!AASInterop.compat(version)) {
      list.push({ key: "aas.protocol", level: "fail", msg: `Incompatible protocol version ${version}` })
      return { ok: false, list }
    }

    list.push({ key: "aas.protocol", level: "ok", msg: `Protocol version ${version} is compatible` })
    return { ok: list.every((x) => x.level !== "fail"), list }
  }
}
