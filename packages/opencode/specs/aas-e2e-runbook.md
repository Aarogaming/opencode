# AAS OpenCode E2E Runbook

Use this runbook to validate OpenCode to AAS bridge integration end to end.

## Preconditions

- AAS repo available at `C:\Dev library\AaroneousAutomationSuite`
- OpenCode repo available at `C:\Dev library\opencode`
- AAS bridge routes enabled:
  - `GET /opencode/bridge/handshake`
  - `POST /opencode/bridge/invoke`

## AAS Startup

From AAS repo root:

```powershell
python hub.py
```

If bridge auth is enabled:

```powershell
$env:AAS_OPENCODE_BRIDGE_TOKEN = "bridge-token"
```

If API middleware auth is enabled:

```powershell
$env:AAS_API_TOKEN = "api-token"
```

## Configure OpenCode AAS profile

From OpenCode repo root:

```powershell
opencode aas init --mode hybrid --bridge "http://127.0.0.1:8000/opencode/bridge/invoke" --token "bridge-token" --header "x-aas-bridge-token" --api-token "api-token" --api-header "x-aas-token"
```

Validate config:

```powershell
opencode aas status
opencode aas doctor --timeout 5000
```

## Install plugin

```powershell
opencode plugin "C:\Dev library\opencode\examples\aas-core-plugin" --global --force
```

## Tool smoke calls

In OpenCode session, run tools:

- `aas_repo_compare` with `{ "root": "C:/Dev library" }`
- `aas_index_search` with `{ "query": "agent interop", "limit": 10 }`
- `aas_protocol_validate` with `{ "target": "agent_interop_request_v1", "payload": { "probe": true } }`
- `aas_policy_evaluate` with `{ "action": "repo.compare", "resource": "C:/Dev library/opencode", "context": {} }`

## Expected

- `aas doctor` reports reachable bridge and compatible protocol.
- Tool responses return JSON strings representing `result` payloads.
- On auth mismatch, tools return deterministic error text with code and message.

## Troubleshooting

- `401 Bridge authentication failed`:
  - verify `--token` and `--header` values
- `401 Invalid or missing credentials`:
  - verify `--api-token` and `--api-header` values
- `Connection refused`:
  - ensure AAS hub is running at `127.0.0.1:8000`
