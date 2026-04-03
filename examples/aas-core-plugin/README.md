# AAS Core Plugin (Example)

This is a minimal external OpenCode server plugin that bridges OpenCode tools to AAS capabilities.

## What it adds

- `aas_repo_compare`
- `aas_index_search`
- `aas_protocol_validate`
- `aas_policy_evaluate`

All tools call a configured AAS bridge endpoint and validate request/response contract shape.

## Install locally

From repo root:

```bash
opencode plugin ./examples/aas-core-plugin
```

Or from anywhere:

```bash
opencode plugin "C:/Dev library/opencode/examples/aas-core-plugin"
```

## Deploy to install-root (Windows)

Use the helper script to sync plugin files to a stable install-root path, then run OpenCode plugin install from that path:

```powershell
powershell -ExecutionPolicy Bypass -File .\examples\aas-core-plugin\deploy.ps1 -InstallRoot "C:\opencode-install-root" -Global -Force
```

What it does:

- mirrors plugin files to `C:\opencode-install-root\plugins\aas-core-plugin`
- runs `opencode plugin <path> --global --force`

Optional flags:

- omit `-Global` for project-local install
- omit `-Force` to keep existing configured version untouched
- override executable path with `-Opencode "C:\path\to\opencode.exe"`

## Configure AAS bridge

```bash
opencode aas init --mode hybrid --bridge https://your-bridge.example/interop
opencode aas doctor
```

For AAS Mission Control, use:

```bash
opencode aas init --mode hybrid --bridge https://your-aas-host/opencode/bridge/invoke
```

Canonical capability IDs expected by AAS bridge:

- `aas.repo.compare`
- `aas.index.search`
- `aas.protocol.validate`
- `aas.policy.evaluate`

Expected args payloads:

- `aas.repo.compare` -> `{ "root": "C:/path/or/repo" }`
- `aas.index.search` -> `{ "query": "string", "limit": 10 }`
- `aas.protocol.validate` -> `{ "target": "string", "payload": { ... } }`
- `aas.policy.evaluate` -> `{ "action": "string", "resource": "optional", "context": { ... } }`

Optional auth/signing flags:

```bash
opencode aas init --mode hybrid --bridge https://your-bridge.example/interop --token "Bearer <token>" --header "authorization" --hmac "shared-signing-key"
```

Optional API middleware token flags:

```bash
opencode aas init --mode hybrid --bridge http://127.0.0.1:8000/opencode/bridge/invoke --token "bridge-token" --header "x-aas-bridge-token" --api-token "api-token" --api-header "x-aas-token"
```

When configured, bridge calls include:

- auth token header (`authorization` by default or your custom header)
- `x-aas-timestamp`
- `x-aas-signature` (HMAC-SHA256 over `<timestamp>.<request-json>`)

If your AAS bridge requires `x-aas-bridge-token`, set:

```bash
opencode aas init --mode hybrid --bridge https://your-aas-host/opencode/bridge/invoke --token "<token>" --header "x-aas-bridge-token"
```

The plugin now probes `/opencode/bridge/handshake` when possible to auto-detect bridge auth header and invoke endpoint hints.

## Usage

In OpenCode session prompts, ask to run:

- `aas_repo_compare` with `{ "root": "C:/Dev library" }`
- `aas_index_search` with `{ "query": "agent interop", "limit": 10 }`
- `aas_protocol_validate` with `{ "target": "agent_interop_request_v1", "payload": { ... } }`
- `aas_policy_evaluate` with `{ "action": "repo.compare", "resource": "C:/Dev library/opencode" }`

## Expected bridge behavior

- Accept POST body with `protocol_version`, ids, `capability`, `mode`, and `payload`.
- Return JSON with:
  - `ok: true` and `data`
  - or `ok: false` and `error`
- Keep protocol major at `1.x`.

## Hardening behavior

- maps upstream timeouts to structured retryable errors
- maps upstream transport failures to structured retryable errors
- rejects incompatible `protocol_version` in bridge responses
- normalizes all tool error text to a stable `<capability> failed: <code> <message>` format

## Notes

- This example is intentionally thin and focused on adapter behavior.
- Move this package into your AAS workspace for production ownership.
