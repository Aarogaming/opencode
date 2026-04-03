import { describe, expect, test } from "bun:test"
import { AASInterop } from "../../src/aas/interop"

describe("aas.interop", () => {
  test("accepts valid envelope", () => {
    const parsed = AASInterop.parseEnvelope({
      protocol_version: "1.0",
      operation_id: "op-1",
      request_id: "req-1",
      capability: "aas.repo.compare",
      mode: "hybrid",
      payload: { scan_path: "C:/Dev library" },
      trace_id: "trace-1",
      created_at_utc: "2026-04-02T00:00:00Z",
    })

    expect(parsed.success).toBe(true)
  })

  test("rejects incompatible major version", () => {
    expect(AASInterop.compat("1.9")).toBe(true)
    expect(AASInterop.compat("2.0")).toBe(false)
    expect(AASInterop.compat("x.y")).toBe(false)
  })

  test("builds ok result", () => {
    const out = AASInterop.ok({
      request_id: "req-2",
      operation_id: "op-2",
      capability: "aas.index.search",
      data: { count: 3 },
      latency_ms: 12,
      finished_at_utc: "2026-04-02T00:00:00Z",
    })

    expect(out.ok).toBe(true)
    expect(out.error).toBeUndefined()
    expect(out.data?.count).toBe(3)
  })

  test("builds failure result", () => {
    const out = AASInterop.fail({
      request_id: "req-3",
      operation_id: "op-3",
      capability: "aas.policy.evaluate",
      code: "policy_denied",
      message: "blocked by profile",
      retryable: false,
      latency_ms: 4,
      finished_at_utc: "2026-04-02T00:00:00Z",
    })

    expect(out.ok).toBe(false)
    expect(out.error?.code).toBe("policy_denied")
    expect(out.data).toBeUndefined()
  })

  test("rejects invalid result shape", () => {
    const parsed = AASInterop.parseResult({
      ok: true,
      request_id: "req-4",
      operation_id: "op-4",
      capability: "aas.protocol.validate",
      error: {
        code: "internal_error",
        message: "should not exist",
        retryable: false,
      },
      latency_ms: 1,
      finished_at_utc: "2026-04-02T00:00:00Z",
    })

    expect(parsed.success).toBe(false)
  })
})
