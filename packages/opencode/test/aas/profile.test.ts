import { describe, expect, test } from "bun:test"
import { AASProfile } from "../../src/aas/profile"
import { Config } from "../../src/config/config"

describe("aas.profile", () => {
  test("builds init patch with defaults", () => {
    const patch = AASProfile.init()
    expect(patch).toEqual({
      aas: {
        enabled: true,
        mode: "offline",
        bridge: undefined,
        auth: undefined,
      },
    })
  })

  test("builds init patch with bridge", () => {
    const patch = AASProfile.init({ mode: "hybrid", bridge: "http://127.0.0.1:4400" })
    expect(patch).toEqual({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "http://127.0.0.1:4400",
        },
        auth: undefined,
      },
    })
  })

  test("builds mode patch", () => {
    const patch = AASProfile.set({ mode: "live" })
    expect(patch).toEqual({
      aas: {
        enabled: true,
        mode: "live",
      },
    })
  })

  test("builds patch with auth options", () => {
    const patch = AASProfile.set({
      mode: "hybrid",
      bridge: "https://bridge.example",
      token: "token",
      header: "x-aas-token",
      hmac: "hmac-key",
      api_token: "api-token",
      api_header: "x-aas-token",
    })
    expect(patch).toEqual({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example",
        },
        auth: {
          token: "token",
          header: "x-aas-token",
          hmac: "hmac-key",
          api_token: "api-token",
          api_header: "x-aas-token",
        },
      },
    })
  })

  test("reads status from config", () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example",
        },
        auth: {
          token: "secret-token",
          header: "x-aas-token",
          hmac: "secret-key",
        },
      },
    })
    const out = AASProfile.get(cfg)
    expect(out).toEqual({
      enabled: true,
      mode: "hybrid",
      bridge: "https://bridge.example",
      auth_header: "x-aas-token",
      has_auth_token: true,
      has_hmac_key: true,
      api_auth_header: undefined,
      has_api_token: false,
    })
  })
})
