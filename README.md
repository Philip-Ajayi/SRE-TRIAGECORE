# SRE TriageCore 🛡️🎙️

> **Hands-Free Ambient Incident Diagnostics & Runbook Synthesis for On-Call Engineers under RFC 9728 Strictly Read-Only Security Scopes.**

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?logo=node.js)](https://nodejs.org/)
[![Model Context Protocol](https://img.shields.io/badge/Protocol-MCP%20Streamable%20HTTP-blue)](https://modelcontextprotocol.io/)
[![Prometheus](https://img.shields.io/badge/Metrics-Prometheus%20PromQL-e6522c?logo=prometheus)](https://prometheus.io/)
[![Security](https://img.shields.io/badge/Security-RFC%209728%20Read--Only-green)](https://datatracker.ietf.org/doc/rfc9728/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Overview

When a P1 alert pages an engineer at 3:00 AM, cognitive load is at its highest. Navigating separate tabs for metric dashboards, Git diffs, and stale wikis causes mean time to resolution (MTTR) to spike.

**SRE TriageCore** is an ambient incident console and MCP server. It correlates real-time Prometheus telemetry, Git commit diffs, and markdown runbooks into a single spoken briefing dispatched to the engineer's workstation—while strictly enforcing **RFC 9728 Protected Resource Metadata (PRM)** to block unauthorized destructive mutations (such as unverified container rollbacks or pod terminations).

---

## Architecture Flow

```
   [ On-Call Engineer (Voice / Web UI) ]
                     │
                     ▼ (Streamable HTTP / SSE JSON-RPC 2.0)
       [ SRE TriageCore MCP Gateway (:8080) ]
                     │
       ┌─────────────┼──────────────┬──────────────────┐
       │             │              │                  │
       ▼             ▼              ▼                  ▼
 [ RFC 9728 Guard ] [ PromQL Engine ] [ Git Correlator ] [ Runbook Parser ]
 (Blocks rollbacks  (Scrapes 5xx     (Parses unified     (Extracts steps
  with HTTP 403)     inflection :9090) diffs on GitHub)   from Markdown)
                     │
                     ▼
             [ auth-service (:4000) ]
        (Synthetic microservice under load)
```

---

## Core Capabilities

1. **Model Context Protocol (MCP) Gateway:** Implements Streamable HTTP Server-Sent Events (`/sse` and `/message`) compliant with the official MCP specification.
2. **RFC 9728 Read-Only Enforcement:** Intercepts mutating actions (`rollback`, `restart`, `terminate`, `patch`) and rejects them with HTTP 403 Forbidden.
3. **Telemetry Inflection Engine:** Evaluates Prometheus PromQL range queries (`rate(http_requests_total{status=~"5.."}[1m])`) to detect the precise minute of failure.
4. **Git Root-Cause Correlation:** Pinpoints the exact pull request merged prior to failure and isolates breaking configuration diffs.
5. **Runbook Markdown AST Resolution:** Scans repository playbooks, matches error signatures, and extracts ordered mitigation steps.
6. **Ambient Voice Console:** Interactive dark-mode dashboard featuring hands-free Web Speech API input, natural speech synthesis, and live diagnostic diff streaming.

---

## System Directory Layout

```
sre-triagecore/
├── docker-compose.yml          # Multi-container orchestration
├── Dockerfile                  # Production unified container
├── start.sh                    # Automated ecosystem launcher
├── inject-fault.sh             # Chaos fault injection script
├── reset-fault.sh              # Service recovery script
├── verify.sh                   # End-to-end acceptance drill
├── runbooks/                   # Incident diagnostic playbooks
│   ├── auth-service.md
│   └── payment-gateway.md
├── src/                        # Core MCP Server (TypeScript)
│   ├── index.ts                # Express app & SSE transport
│   ├── security/prm.ts         # RFC 9728 read-only boundary guard
│   ├── tools/                  # MCP tools (telemetry, github, runbook)
│   └── orchestrator/           # Voice briefing synthesizer
├── simulator/                  # Local testbed infrastructure
│   ├── auth-service/           # Microservice emitting Prometheus metrics
│   ├── traffic-generator/      # Synthetic continuous traffic
│   └── prometheus/             # Metric scraper configuration
└── client/public/              # Futuristic developer incident UI
```

---

## Prerequisites

- [Docker & Docker Compose](https://www.docker.com/) (recommended)
- [Node.js](https://nodejs.org/) (v20+ if running locally outside Docker)

---

## Quickstart: How to Run & Reproduce

### Option A: Complete Docker Compose Stack (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Philip-Ajayi/sre-triagecore.git
   cd sre-triagecore
   ```

2. **Make scripts executable:**
   ```bash
   chmod +x start.sh inject-fault.sh reset-fault.sh verify.sh
   ```

3. **Launch the ecosystem:**
   ```bash
   ./start.sh
   ```
   *This starts the MCP Gateway (`:8080`), Prometheus scraper (`:9090`), `auth-service` (`:4000`), and continuous synthetic traffic generator in the background.*

4. **Open the Incident Console:**
   Navigate to **[http://localhost:8080](http://localhost:8080)** in your browser.

---

### Option B: Local Node.js Development

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Start development server
npm run dev
```

---

## Step-by-Step Incident Drill (Demonstration Guide)

Follow these steps to demonstrate the full diagnostic workflow:

### 1. Observe Nominal Baseline
- Open [http://localhost:8080](http://localhost:8080).
- Notice the incident status reads **nominal** with an error rate of `< 0.1%`.

### 2. Inject Chaos Fault
Simulate PR #412 throttling the Redis connection pool from 50 down to 5 sockets:
- Click **"⚡ Simulate failure"** on the dashboard, OR run in your terminal:
  ```bash
  ./inject-fault.sh
  ```
- Prometheus immediately begins recording 500 Internal Server Errors from the synthetic traffic generator.

### 3. Trigger Voice Triage
- Click the **pulsing microphone** button (or click **"Investigate an alert"**).
- If your microphone is active, say: *"PagerDuty alert on auth-service."*
- **The system speaks the briefing:**
  > *"auth-service 500 error rate spiked to 22.4% starting 2 minutes ago. Root cause correlation: PR #412 by dev-alex merged 18 minutes ago modified Redis pool max connections in config.json from 50 to 5. Runbook step 1: Check Redis connection pool exhaustion. Runbook step 2: Revert config.json in staging branch. Full incident report dispatched to your terminal."*
- The investigation log and git patch viewer update in real time.

### 4. Verify RFC 9728 Security Boundary Enforcement
- Click the button **"Request a rollback"** (or say: *"Roll back the deployment"*).
- **The system speaks the refusal:**
  > *"Rollback denied. SRE TriageCore operates strictly under read-only security scopes. Remediate via your terminal."*
- The terminal displays an **HTTP 403 Forbidden** security policy response.

### 5. Restore Service
- Click **"↻ Restore service"**, OR run in your terminal:
  ```bash
  ./reset-fault.sh
  ```
- The error rate returns to 0.0%.

---

## Automated Verification Suite

To run the automated end-to-end integration test suite without a browser:

```bash
./verify.sh
```

Or run the unit tests directly via Node:
```bash
npm test
```

Expected output:
```text
RUNNING SRE TRIAGECORE PRODUCTION VERIFICATION SUITE
✓ PASS: RFC 9728 Strictly Read-Only boundaries verified.
✓ PASS: Runbook resolution succeeded (Mitigation steps extracted).
✓ PASS: Unified diff correlation accurately parsed Redis pool regression diff.
✓ PASS: Telemetry extracted via Prometheus PromQL engine.
✓ PASS: Voice synthesis matches specification.
ALL VERIFICATION SUITE CHECKS PASSED (5/5)
```

---

## Environment Variables (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | MCP Express HTTP & SSE Port | `8080` |
| `HOST` | Bind host address | `0.0.0.0` |
| `PROMETHEUS_URL` | Prometheus scraper API URL | `http://localhost:9090` |
| `AUTH_SERVICE_URL` | Target simulated microservice URL | `http://localhost:4000` |
| `USE_MOCK_GITHUB` | Toggle between local realistic diffs and live GitHub API | `true` |
| `GITHUB_TOKEN` | Optional GitHub Personal Access Token for live repo inspection | `""` |
| `RUNBOOK_DIR` | Relative directory holding Markdown incident runbooks | `./runbooks` |

---

## Cloud Deployment (Render)

This repository includes a `render.yaml` blueprint and a self-contained `start-all.sh` launcher:

1. Push your code to GitHub.
2. In Render, select **New → Blueprint** and connect this repository.
3. Render automatically builds the multi-stage Docker container and starts Prometheus, the microservice simulator, and the MCP server under one single port.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
