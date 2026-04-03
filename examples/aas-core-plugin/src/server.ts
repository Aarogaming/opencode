import type { PluginModule } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import { call } from "./bridge"

function mode(input: unknown): "offline" | "hybrid" | "live" {
  if (!input || typeof input !== "object") return "offline"
  if (!("aas" in input)) return "offline"
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return "offline"
  if (!("mode" in aas)) return "offline"
  const value = (aas as { mode?: unknown }).mode
  if (value === "offline" || value === "hybrid" || value === "live") return value
  return "offline"
}

function bridge(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("bridge" in aas)) return
  const item = (aas as { bridge?: unknown }).bridge
  if (!item || typeof item !== "object") return
  if (!("url" in item)) return
  const url = (item as { url?: unknown }).url
  if (typeof url !== "string" || !url.trim()) return
  return url
}

function token(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("auth" in aas)) return
  const auth = (aas as { auth?: unknown }).auth
  if (!auth || typeof auth !== "object") return
  if (!("token" in auth)) return
  const out = (auth as { token?: unknown }).token
  if (typeof out !== "string" || !out.trim()) return
  return out
}

function hdr(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("auth" in aas)) return
  const auth = (aas as { auth?: unknown }).auth
  if (!auth || typeof auth !== "object") return
  if (!("header" in auth)) return
  const out = (auth as { header?: unknown }).header
  if (typeof out !== "string" || !out.trim()) return
  return out
}

function key(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("auth" in aas)) return
  const auth = (aas as { auth?: unknown }).auth
  if (!auth || typeof auth !== "object") return
  if (!("hmac" in auth)) return
  const out = (auth as { hmac?: unknown }).hmac
  if (typeof out !== "string" || !out.trim()) return
  return out
}

function api(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("auth" in aas)) return
  const auth = (aas as { auth?: unknown }).auth
  if (!auth || typeof auth !== "object") return
  if (!("api_token" in auth)) return
  const out = (auth as { api_token?: unknown }).api_token
  if (typeof out !== "string" || !out.trim()) return
  return out
}

function apiHdr(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return
  if (!("aas" in input)) return
  const aas = (input as { aas?: unknown }).aas
  if (!aas || typeof aas !== "object") return
  if (!("auth" in aas)) return
  const auth = (aas as { auth?: unknown }).auth
  if (!auth || typeof auth !== "object") return
  if (!("api_header" in auth)) return
  const out = (auth as { api_header?: unknown }).api_header
  if (typeof out !== "string" || !out.trim()) return
  return out
}

function text(input: { cap: string; code?: string; message?: string }) {
  const code = input.code ?? "internal_error"
  const message = input.message ?? "unknown"
  return `${input.cap} failed: ${code} ${message}`
}

function json(input: unknown) {
  return JSON.stringify(input ?? {}, null, 2)
}

const plugin: PluginModule & { id: string } = {
  id: "aas.core",
  server: async (_ctx) => {
    let cfg: unknown
    return {
      config: async (next) => {
        cfg = next
      },
      tool: {
        aas_repo_compare: tool({
          description: "Compare local repo state via AAS bridge",
          args: {
            root: tool.schema.string().describe("Path root to scan"),
          },
          execute: async (args) => {
            const url = bridge(cfg)
            if (!url) return "AAS bridge is not configured. Run: opencode aas init --bridge <url>"
            const res = await call({
              bridge: url,
              capability: "aas.repo.compare",
              mode: mode(cfg),
              payload: {
                root: args.root,
              },
              auth: {
                token: token(cfg),
                hdr: hdr(cfg),
                key: key(cfg),
                api_token: api(cfg),
                api_hdr: apiHdr(cfg),
              },
            })
            if (!res.ok) {
              return text({
                cap: "repo.compare",
                code: res.error?.code,
                message: res.error?.message,
              })
            }
            return json(res.data)
          },
        }),
        aas_index_search: tool({
          description: "Search shared AAS index via bridge",
          args: {
            query: tool.schema.string().describe("Search query"),
            limit: tool.schema.number().int().positive().max(50).optional(),
          },
          execute: async (args) => {
            const url = bridge(cfg)
            if (!url) return "AAS bridge is not configured. Run: opencode aas init --bridge <url>"
            const res = await call({
              bridge: url,
              capability: "aas.index.search",
              mode: mode(cfg),
              payload: {
                query: args.query,
                limit: args.limit ?? 10,
              },
              auth: {
                token: token(cfg),
                hdr: hdr(cfg),
                key: key(cfg),
                api_token: api(cfg),
                api_hdr: apiHdr(cfg),
              },
            })
            if (!res.ok) {
              return text({
                cap: "index.search",
                code: res.error?.code,
                message: res.error?.message,
              })
            }
            return json(res.data)
          },
        }),
        aas_protocol_validate: tool({
          description: "Validate protocol payload shape via AAS bridge",
          args: {
            target: tool.schema.string().describe("Named target payload or route"),
            payload: tool.schema.record(tool.schema.string(), tool.schema.unknown()),
          },
          execute: async (args) => {
            const url = bridge(cfg)
            if (!url) return "AAS bridge is not configured. Run: opencode aas init --bridge <url>"
            const res = await call({
              bridge: url,
              capability: "aas.protocol.validate",
              mode: mode(cfg),
              payload: {
                target: args.target,
                payload: args.payload,
              },
              auth: {
                token: token(cfg),
                hdr: hdr(cfg),
                key: key(cfg),
                api_token: api(cfg),
                api_hdr: apiHdr(cfg),
              },
            })
            if (!res.ok) {
              return text({
                cap: "protocol.validate",
                code: res.error?.code,
                message: res.error?.message,
              })
            }
            return json(res.data)
          },
        }),
        aas_policy_evaluate: tool({
          description: "Evaluate policy decision for an action via AAS bridge",
          args: {
            action: tool.schema.string().describe("Action name to evaluate"),
            resource: tool.schema.string().optional().describe("Optional resource identifier"),
            context: tool.schema.record(tool.schema.string(), tool.schema.unknown()).optional(),
          },
          execute: async (args) => {
            const url = bridge(cfg)
            if (!url) return "AAS bridge is not configured. Run: opencode aas init --bridge <url>"
            const res = await call({
              bridge: url,
              capability: "aas.policy.evaluate",
              mode: mode(cfg),
              payload: {
                action: args.action,
                resource: args.resource,
                context: args.context ?? {},
              },
              auth: {
                token: token(cfg),
                hdr: hdr(cfg),
                key: key(cfg),
                api_token: api(cfg),
                api_hdr: apiHdr(cfg),
              },
            })
            if (!res.ok) {
              return text({
                cap: "policy.evaluate",
                code: res.error?.code,
                message: res.error?.message,
              })
            }
            return json(res.data)
          },
        }),
      },
    }
  },
}

export default plugin
