import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { AASDoctor } from "../../src/aas/doctor"

describe("aas.doctor", () => {
  test("fails when aas is disabled", async () => {
    const cfg = Config.Info.parse({})
    const out = await AASDoctor.run(cfg, {
      fetcher: async () => new Response(null, { status: 200 }),
    })
    expect(out.ok).toBe(false)
    expect(out.list.some((x) => x.key === "aas.enabled" && x.level === "warn")).toBe(true)
  })

  test("fails live mode without bridge", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "live",
      },
    })
    const out = await AASDoctor.run(cfg)
    expect(out.ok).toBe(false)
    expect(out.list.some((x) => x.key === "aas.bridge" && x.level === "fail")).toBe(true)
  })

  test("passes with reachable compatible bridge", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/health",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async () =>
        new Response(
          JSON.stringify({
            protocol_version: "1.2",
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(true)
    expect(out.list.some((x) => x.key === "aas.protocol.version" && x.level === "ok")).toBe(true)
  })

  test("passes when AAS handshake protocol is reported", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/opencode/bridge/invoke",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async (_url) =>
        new Response(
          JSON.stringify({
            ok: true,
            protocol: "aas.opencode.bridge.v1",
            auth: {
              required: false,
              header: "x-aas-bridge-token",
              bearer: true,
            },
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(true)
    expect(out.list.some((x) => x.key === "aas.protocol.handshake" && x.level === "ok")).toBe(true)
    expect(out.list.some((x) => x.key === "aas.api_auth" && x.level === "warn")).toBe(true)
  })

  test("warns when handshake requires token but token is missing", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/opencode/bridge/invoke",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async (_url) =>
        new Response(
          JSON.stringify({
            ok: true,
            protocol: "aas.opencode.bridge.v1",
            auth: {
              required: true,
              header: "x-aas-bridge-token",
              bearer: true,
            },
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(true)
    expect(out.list.some((x) => x.key === "aas.auth" && x.level === "warn")).toBe(true)
    expect(out.list.some((x) => x.key === "aas.api_auth" && x.level === "warn")).toBe(true)
  })

  test("marks api auth configured when token is present", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/opencode/bridge/invoke",
        },
        auth: {
          api_token: "token",
          api_header: "x-aas-token",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async (_url) =>
        new Response(
          JSON.stringify({
            ok: true,
            protocol: "aas.opencode.bridge.v1",
            auth: {
              required: false,
              header: "x-aas-bridge-token",
              bearer: true,
            },
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(true)
    expect(out.list.some((x) => x.key === "aas.api_auth" && x.level === "ok")).toBe(true)
  })

  test("fails incompatible protocol", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/health",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async () =>
        new Response(
          JSON.stringify({
            protocol_version: "2.0",
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(false)
    expect(out.list.some((x) => x.key === "aas.protocol.version" && x.level === "fail")).toBe(true)
  })

  test("fails unsupported handshake protocol identifier", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "hybrid",
        bridge: {
          url: "https://bridge.example/opencode/bridge/invoke",
        },
      },
    })

    const out = await AASDoctor.run(cfg, {
      fetcher: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            protocol: "other.bridge.v9",
          }),
          { status: 200 },
        ),
    })

    expect(out.ok).toBe(false)
    expect(out.list.some((x) => x.key === "aas.protocol.handshake" && x.level === "fail")).toBe(true)
  })
})
