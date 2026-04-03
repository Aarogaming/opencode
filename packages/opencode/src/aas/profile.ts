import z from "zod/v4"
import { Config } from "@/config/config"

export namespace AASProfile {
  export const mode = z.enum(["offline", "hybrid", "live"]).meta({ ref: "AASProfileMode" })
  export type mode = z.infer<typeof mode>

  function bridge(url?: string) {
    if (!url) return undefined
    return { url }
  }

  function auth(input?: { token?: string; header?: string; hmac?: string }) {
    if (!input?.token && !input?.header && !input?.hmac) return undefined
    return {
      token: input?.token,
      header: input?.header,
      hmac: input?.hmac,
    }
  }

  function api(input?: { api_token?: string; api_header?: string }) {
    if (!input?.api_token && !input?.api_header) return undefined
    return {
      api_token: input?.api_token,
      api_header: input?.api_header,
    }
  }

  export function init(input?: {
    mode?: mode
    bridge?: string
    token?: string
    header?: string
    hmac?: string
    api_token?: string
    api_header?: string
  }) {
    const item = {
      ...auth(input),
      ...api(input),
    }
    return {
      aas: {
        enabled: true,
        mode: input?.mode ?? "offline",
        bridge: bridge(input?.bridge),
        auth: Object.keys(item).length ? item : undefined,
      },
    } satisfies Partial<Config.Info>
  }

  export function set(input: {
    mode: mode
    bridge?: string
    token?: string
    header?: string
    hmac?: string
    api_token?: string
    api_header?: string
  }) {
    const item = {
      ...auth(input),
      ...api(input),
    }
    return {
      aas: {
        enabled: true,
        mode: input.mode,
        bridge: bridge(input.bridge),
        auth: Object.keys(item).length ? item : undefined,
      },
    } satisfies Partial<Config.Info>
  }

  export function get(cfg: Config.Info) {
    return {
      enabled: cfg.aas?.enabled ?? false,
      mode: cfg.aas?.mode ?? "offline",
      bridge: cfg.aas?.bridge?.url,
      auth_header: cfg.aas?.auth?.header,
      has_auth_token: Boolean(cfg.aas?.auth?.token),
      has_hmac_key: Boolean(cfg.aas?.auth?.hmac),
      api_auth_header: cfg.aas?.auth?.api_header,
      has_api_token: Boolean(cfg.aas?.auth?.api_token),
    }
  }
}
