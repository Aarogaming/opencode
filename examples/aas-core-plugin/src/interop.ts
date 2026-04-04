import { z } from "zod"

export const Mode = z.enum(["offline", "hybrid", "live"])

export const Envelope = z.object({
  protocol_version: z.string().regex(/^1\.[0-9]+$/),
  operation_id: z.string().min(1),
  request_id: z.string().min(1),
  capability: z.string().min(1),
  mode: Mode,
  payload: z.record(z.string(), z.unknown()),
  created_at_utc: z.string().min(1),
})

export const Invoke = z.object({
  command: z.literal("capability.invoke"),
  request_id: z.string().min(1),
  operation_id: z.string().min(1),
  capability: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  mode: Mode,
  protocol_version: z.string().regex(/^1\.[0-9]+$/),
})

export const Failure = z.object({
  code: z.enum([
    "bad_request",
    "bad_response",
    "upstream_timeout",
    "upstream_unavailable",
    "policy_denied",
    "internal_error",
  ]),
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const Result = z
  .object({
    ok: z.boolean(),
    request_id: z.string().min(1),
    operation_id: z.string().min(1),
    capability: z.string().min(1),
    data: z.record(z.string(), z.unknown()).optional(),
    error: Failure.optional(),
    latency_ms: z.number().int().nonnegative(),
    finished_at_utc: z.string().min(1),
    protocol_version: z
      .string()
      .regex(/^1\.[0-9]+$/)
      .optional(),
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
  })

export type Envelope = z.infer<typeof Envelope>
export type Invoke = z.infer<typeof Invoke>
export type Result = z.infer<typeof Result>

export function parseResult(input: unknown) {
  return Result.safeParse(input)
}

export function parseInvoke(input: unknown) {
  return Invoke.parse(input)
}

export function compatible(version: string, expected = 1) {
  const hit = version.match(/^(\d+)\./)
  if (!hit?.[1]) return false
  return Number.parseInt(hit[1], 10) === expected
}
