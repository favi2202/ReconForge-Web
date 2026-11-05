# Local authorized tool runner

The v0.3 preview branch adds an opt-in local pipeline for authorized targets. It is disabled unless both connected owner mode and local tool execution are enabled.

## Enable locally

Add these values to the API environment:

```env
CONNECTED_MODE=true
LOCAL_TOOLS_ENABLED=true
LOCAL_TOOL_TIMEOUT_MS=30000
```

Keep `APP_ACCESS_TOKEN` configured and keep the API bound to `127.0.0.1` for a local WSL setup.

## Quick pipeline

The first profile runs a fixed sequence:

```text
Subfinder -> DNSx -> HTTPx -> Nuclei
```

For an exact-host scope, Subfinder is skipped so the run cannot silently expand into sibling or child hosts. For a subdomain-tree scope, discovered hostnames are filtered against the parsed scope and exclusions after every stage.

The API constructs all command arguments. The browser cannot submit shell text, arbitrary flags, executable paths, or arbitrary target URLs.

## Safety boundaries

- Public-suffix scopes are rejected for active local execution.
- Multi-domain project lists remain planner-only.
- Local execution is off by default.
- One local run may execute per owner at a time.
- Child processes use `shell: false`.
- Every stage has a fixed timeout and a 2 MiB output cap.
- HTTPx and Nuclei use low fixed request rates in the quick profile.
- Tool stderr is not returned to the browser.
- Nuclei output is accepted only when its matched hostname remains inside the approved scope.

## Required tools

The current preview detects these executables from the API process `PATH`:

- `subfinder`
- `dnsx`
- `httpx`
- `nuclei`

Missing tools are shown in the Local tools page. Later adapters can add `naabu`, `nmap`, `ffuf`, `gobuster`, `testssl`, and screenshot tooling without adding arbitrary command execution.

## Run from the UI

Create one exact-domain or subdomain-tree project, configure the owner API session, open **Local tools**, review tool health, confirm authorization for the exact scope, and start the quick pipeline.

Local run state is currently in memory. Restarting the API clears local run history.
