import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { AASDoctor } from "../../src/aas/doctor"

describe("aas.doctor.extra", () => {
  test("warns when protocol version is missing", async () => {
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
      fetcher: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    })

    expect(out.ok).toBe(true)
    expect(out.list.some((x) => x.key === "aas.protocol" && x.level === "warn")).toBe(true)
  })

  test("fails invalid bridge url", async () => {
    const cfg = Config.Info.parse({
      aas: {
        enabled: true,
        mode: "offline",
        bridge: {
          url: "%%%%",
        },
      },
    })

    const out = await AASDoctor.run(cfg)
    expect(out.ok).toBe(false)
    expect(out.list.some((x) => x.key === "aas.bridge" && x.level === "fail")).toBe(true)
  })
})
