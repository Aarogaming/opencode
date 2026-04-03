# AAS Fascia Plan

This spec defines a practical path to use OpenCode as the operator UX for AAS engines.

## Goal

- OpenCode owns UX: chat, approvals, sessions, tool invocation, and TUI.
- AAS owns engines: index, discovery, protocol validation, orchestration, and policy.
- Bridge contract owns interoperability and versioned compatibility.

## Scope

- `v1` delivers a bridge skeleton and four high-value capabilities.
- `v1` does not rewrite AAS engines into OpenCode internals.
- `v1` keeps direct DB/file sharing out of scope.

## Phases

### P0 Contracts and Boundaries

- Define schemas:
  - `InteropRequest`
  - `InteropResponse`
  - `ToolEnvelope`
  - `IndexQuery`
  - `PolicyDecision`
- Define compatibility policy:
  - major version must match
  - additive fields allowed on minor increments
  - unknown fields tolerated at the edge, not in core execution paths
- Define error taxonomy:
  - `bad_request`
  - `bad_response`
  - `upstream_timeout`
  - `upstream_unavailable`
  - `policy_denied`
  - `internal_error`

Exit gate:

- Shared schema package and fixtures committed.
- Compatibility matrix documented.

### P1 Bridge Skeleton

- Add `aas-core` server plugin skeleton for OpenCode.
- Add `aas-bridge` adapter skeleton (MCP-first path).
- Implement request/response normalization and strict parsing.
- Add correlation id and trace metadata propagation.

Exit gate:

- OpenCode can invoke bridge calls for at least three capabilities.
- Error shape is stable and typed.

### P2 High-ROI Capabilities

- `aas.repo.compare`
- `aas.index.search`
- `aas.protocol.validate`
- `aas.policy.evaluate`

Exit gate:

- All four capabilities return deterministic structured output.
- Permission and policy checks are observable in logs/events.

### P3 End-User Simplification

- Add one setup command: `aas init`.
- Add one runtime mode command: `aas mode offline|hybrid|live`.
- Group commands and tools under a single `aas.*` namespace.
- Provide concise user-facing messages with direct remediation text.

Exit gate:

- New operator reaches first successful workflow in under 10 minutes.

### P4 Test and Validation

- Unit tests:
  - schema parsing
  - policy mapping
  - response normalization
- Contract tests:
  - request/response fixtures for each protocol version
- Integration tests:
  - OpenCode plugin -> adapter -> AAS test stub
- E2E tests:
  - repo compare and index search full flow

Exit gate:

- CI green and contract suite pinned to schema versions.

### P5 Trial-by-Fire and Chaos

- Inject faults:
  - latency
  - timeouts
  - malformed payloads
  - partial upstream failures
  - permission service unavailable
- Verify graceful degradation:
  - bounded retries
  - no infinite loops
  - actionable operator feedback

Exit gate:

- Soak run passes reliability targets without data corruption.

### P6 Hardening

- Idempotency keys on mutating operations.
- Retry with jitter and capped attempts.
- Circuit breaker per upstream endpoint.
- Queue backpressure with bounded worker pools.
- Audit logs with request id and policy decision.

Exit gate:

- SLO targets met under normal and degraded modes.

## Recursive Logic Review Loop

Apply this loop before each merge:

1. Assumption: what must be true for this to work?
2. Failure mode: how does it break?
3. Blast radius: who or what is affected?
4. Guardrail: what contains impact?
5. Probe: what test proves containment?

## Requirements

### Runtime

- OpenCode with server plugin support enabled.
- AAS bridge endpoint reachable from operator machine.
- Shared schema version known at startup.

### Security

- Deny-by-default policy profile.
- Explicit allowlist for tool namespaces.
- Request signing or authenticated transport for bridge calls.

### Observability

- Structured logs with:
  - `request_id`
  - `trace_id`
  - `tool`
  - `mode`
  - `latency_ms`
  - `status`
- Metrics for success rate, retries, and timeout counts.

## Usage Expectations

### End User

- Runs plain-language prompts and `aas.*` commands.
- Picks mode once per session (`offline`, `hybrid`, `live`).
- Receives concise remediation when operations fail.

### Operator

- Owns policy profile defaults and rollout flags.
- Monitors dashboard and audit logs.
- Handles break-glass override process.

### Developer

- Adds new capability by:
  1. defining schema
  2. implementing adapter mapping
  3. adding contract fixtures
  4. adding integration tests

## Success Criteria

- OpenCode acts as primary UX for Library, Merlin-like orchestration, and Guild workflows.
- AAS engines remain independently deployable.
- Bridge contracts remain stable across iterative releases.
