import z from "zod/v4"

export namespace AASInterop {
  export const mode = z.enum(["offline", "hybrid", "live"]).meta({ ref: "AASMode" })

  export const error_code = z
    .enum([
      "bad_request",
      "bad_response",
      "upstream_timeout",
      "upstream_unavailable",
      "policy_denied",
      "internal_error",
    ])
    .meta({ ref: "AASErrorCode" })

  export const envelope = z
    .object({
      protocol_version: z.string().regex(/^1\.[0-9]+$/),
      operation_id: z.string().min(1),
      request_id: z.string().min(1),
      capability: z.string().min(1),
      mode,
      payload: z.record(z.string(), z.unknown()),
      trace_id: z.string().min(1).optional(),
      created_at_utc: z.string().min(1),
    })
    .meta({ ref: "AASInteropEnvelope" })

  export type envelope = z.infer<typeof envelope>

  export const failure = z
    .object({
      code: error_code,
      message: z.string().min(1),
      retryable: z.boolean(),
      details: z.record(z.string(), z.unknown()).optional(),
    })
    .meta({ ref: "AASInteropFailure" })

  export type failure = z.infer<typeof failure>

  export const result = z
    .object({
      ok: z.boolean(),
      request_id: z.string().min(1),
      operation_id: z.string().min(1),
      capability: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
      error: failure.optional(),
      latency_ms: z.number().int().nonnegative(),
      finished_at_utc: z.string().min(1),
    })
    .superRefine((val, ctx) => {
      if (!val.ok && !val.error) {
        ctx.addIssue({
          code: "custom",
          message: "error is required when ok is false",
        })
      }
      if (val.ok && val.error) {
        ctx.addIssue({
          code: "custom",
          message: "error must be absent when ok is true",
        })
      }
      if (!val.ok && val.data) {
        ctx.addIssue({
          code: "custom",
          message: "data must be absent when ok is false",
        })
      }
    })
    .meta({ ref: "AASInteropResult" })

  export type result = z.infer<typeof result>

  export function parseEnvelope(input: unknown) {
    return envelope.safeParse(input)
  }

  export function parseResult(input: unknown) {
    return result.safeParse(input)
  }

  export function compat(version: string, expected = 1) {
    const hit = version.match(/^(\d+)\./)
    if (!hit?.[1]) return false
    return Number.parseInt(hit[1], 10) === expected
  }

  export function fail(input: {
    request_id: string
    operation_id: string
    capability: string
    code: failure["code"]
    message: string
    retryable?: boolean
    details?: Record<string, unknown>
    latency_ms?: number
    finished_at_utc?: string
  }) {
    return result.parse({
      ok: false,
      request_id: input.request_id,
      operation_id: input.operation_id,
      capability: input.capability,
      error: {
        code: input.code,
        message: input.message,
        retryable: input.retryable ?? false,
        details: input.details,
      },
      latency_ms: input.latency_ms ?? 0,
      finished_at_utc: input.finished_at_utc ?? new Date().toISOString(),
    })
  }

  export function ok(input: {
    request_id: string
    operation_id: string
    capability: string
    data?: Record<string, unknown>
    latency_ms?: number
    finished_at_utc?: string
  }) {
    return result.parse({
      ok: true,
      request_id: input.request_id,
      operation_id: input.operation_id,
      capability: input.capability,
      data: input.data ?? {},
      latency_ms: input.latency_ms ?? 0,
      finished_at_utc: input.finished_at_utc ?? new Date().toISOString(),
    })
  }
}
