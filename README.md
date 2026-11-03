# SRE TriageCore 🛡️🎙️

[![M8ven Verified](https://m8ven.ai/badge/mcp/philip-ajayi/sre-triagecore)](https://m8ven.ai/mcp/philip-ajayi/sre-triagecore)

When a high-severity alert wakes you up at 3:00 AM, the hardest part is piecing together what happened. You usually find yourself juggling multiple browser tabs: one for metric dashboards, another for GitHub pull requests, another for team wikis, and a terminal window.

**SRE TriageCore** is a hands-free incident assistant designed to cut through that noise. It connects directly to your metrics, recent code changes, and markdown runbooks, then summarizes everything into a plain-English voice briefing right on your screen. To keep your systems safe while you investigate, it operates under strict read-only security rules (based on RFC 9728)—meaning it will never trigger automatic rollbacks, restarts, or accidental writes.

---

## What We Are Building

SRE TriageCore combines four core capabilities into a single incident dashboard:

1. **Hands-Free Ambient Voice Assistant:** Talk to your incident console directly using your browser's microphone. You can ask what broke, and the system speaks back an immediate diagnosis.
2. **Prometheus Telemetry Scraper:** Watches for real-time 5xx spikes and flags the exact time an error rate shifted.
3. **Git Code Correlation:** Pulls recent merged pull requests, compares commits against the failure timeline, and highlights the breaking diff (such as an exhausted connection pool).
4. **Markdown Runbook Parser:** Scans your checked-in incident runbooks and extracts ordered recovery steps so you know what to do next.
5. **Strict Read-Only Guardrails (RFC 9728):** Rejects any destructive requests—like attempting to trigger a container rollback or service restart through the assistant—returning an explicit `HTTP 403 Forbidden`.

---

## System Architecture

```text
       [ On-Call Engineer (Voice or Web Console) ]
                           │
                           ▼ (Streamable HTTP / SSE)
            [ SRE TriageCore Server (:8080) ]
                           │
      ┌────────────────────┼───────────────────┬───────────────────┐
      │                    │                   │                   │
      ▼                    ▼                   ▼                   ▼
[ RFC 9728 Guard ]  [ Prometheus Engine ]  [ Git Engine ]   [ Runbook Parser ]
Blocks unsafe       Scrapes 5xx error      Inspects recent  Extracts mitigation
mutations (403)     rates (:9090)          code changes     steps from markdown
                           │
                           ▼
                  [ auth-service (:4000) ]
               Synthetic service under load
```

---

## What You Need to Know Before Starting

- **Default Mode:** Out of the box, the project uses a built-in mock git diff engine, meaning **you do not need a GitHub token or external credentials** to run and test the complete incident workflow.
- **Microservices Included:** The setup includes a mock microservice (`auth-service`), continuous synthetic traffic generator, and Prometheus metrics scraper so you can simulate real failures on your machine.
- **Browser Compatibility:** For the hands-free voice feature, use a browser that supports the Web Speech API (such as Google Chrome, Brave, or Edge). If voice input is not supported or permitted, you can click the pre-built investigation buttons on the dashboard.

---

## Prerequisites

Make sure you have one of the following installed:

- **Docker and Docker Compose** (strongly recommended for the easiest setup)
- **Node.js 20+** and **npm** (if running locally without Docker)

---

## Step-by-Step Setup Guide

### 1. Clone the Repository

Open your terminal and clone the repository:

```bash
git clone https://github.com/Philip-Ajayi/sre-triagecore.git
cd sre-triagecore
```

### 2. Make Helper Scripts Executable

Run the following command to make sure the automation scripts can run:

```bash
chmod +x start.sh start-all.sh inject-fault.sh reset-fault.sh verify.sh
```

### 3. Configure Environment Variables

The project works out of the box with default values, but you can create a `.env` file in the root directory to customize the configuration:

```bash
cp .env.example .env 2>/dev/null || touch .env
```

Here is an example `.env` configuration:

```env
# Server Network Settings
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=info

# Prometheus Metrics Scraper
PROMETHEUS_URL=http://localhost:9090

# Target Microservice
AUTH_SERVICE_URL=http://localhost:4000

# Git Integration Settings
USE_MOCK_GITHUB=true
GITHUB_TOKEN=
GITHUB_OWNER=acme-corp
GITHUB_REPO=cloud-platform

# Incident Runbooks Directory
RUNBOOK_DIR=./runbooks
```

#### Environment Variables Explained:
- `PORT`: The port where the incident console and API run (default: `8080`).
- `USE_MOCK_GITHUB`: Set to `true` to use the built-in offline regression diff. Set to `false` if you want to connect to a live GitHub repository.
- `GITHUB_TOKEN`: A GitHub Personal Access Token (classic or fine-grained with read access to PRs). Only required if `USE_MOCK_GITHUB` is set to `false`.
- `PROMETHEUS_URL`: The URL of the Prometheus server scraping your services.
- `AUTH_SERVICE_URL`: The URL of the microservice being monitored.
- `RUNBOOK_DIR`: Path to the markdown runbooks directory.

---

## How to Run the Project

### Option A: Using Docker Compose (Recommended)

This command builds and starts the web console, the simulated `auth-service`, Prometheus, and the background traffic generator all at once:

```bash
./start.sh
```

Once running, open your browser and navigate to:
**[http://localhost:8080](http://localhost:8080)**

---

### Option B: Running Locally (Node.js)

If you prefer to run the Node.js server directly on your host machine:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the TypeScript files:**
   ```bash
   npm run build
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   *(For live development with automatic restarts, use `npm run dev` instead).*

---

## Walking Through an Incident Drill

Once the app is running at `http://localhost:8080`, you can test an end-to-end incident investigation:

1. **Check the baseline:** The status banner will indicate that the service is healthy with an error rate near `0.0%`.
2. **Trigger a failure:** Click **"⚡ Simulate failure"** on the dashboard (or run `./inject-fault.sh` in your terminal). This simulates a misconfiguration that restricts the Redis connection pool from 50 to 5 sockets, causing HTTP 500 errors to spike.
3. **Investigate by voice or click:** Click the microphone and say:
   > *"PagerDuty alert on auth-service."*  
   *(Or simply click **"Investigate an alert"** on screen).*
4. **Hear and review the briefing:** The system will speak the diagnosis, display the metric inflection timestamp, show the correlated PR diff, and present mitigation steps from the runbook.
5. **Test safety guardrails:** Click **"Request a rollback"** (or say *"Roll back the deployment"*). The assistant will refuse the action and display an `HTTP 403 Forbidden` response to prevent unauthorized changes.
6. **Restore service:** Click **"↻ Restore service"** (or run `./reset-fault.sh`) to return metrics back to nominal.

---

## Running Automated Tests

To run the verification suite that checks RFC 9728 security boundaries, runbook parsing, git diff extraction, and telemetry queries:

```bash
npm test
```

Or run the full end-to-end integration check against running services:

```bash
./verify.sh
```

---

## Project Structure

```text
sre-triagecore/
├── client/public/             # Web dashboard and audio interface
├── runbooks/                  # Markdown incident response guides
│   ├── auth-service.md
│   └── payment-gateway.md
├── simulator/                 # Local test infrastructure
│   ├── auth-service/          # Sample microservice emitting Prometheus metrics
│   ├── prometheus/            # Prometheus configuration
│   └── traffic-generator/     # Sends continuous traffic to the sample service
├── src/
│   ├── index.ts               # Express application entrypoint
│   ├── config.ts              # Environment configuration & validation
│   ├── orchestrator/          # Voice briefing generator
│   ├── security/              # RFC 9728 read-only boundary enforcement
│   ├── tools/                 # Tool definitions for metrics, GitHub, and runbooks
│   └── utils/                 # Structured logging
├── docker-compose.yml         # Container configuration for full local stack
├── Dockerfile                 # Unified container definition
├── inject-fault.sh            # Script to simulate service failure
├── reset-fault.sh             # Script to restore service
├── start.sh                   # Startup script for Docker Compose
└── verify.sh                  # End-to-end verification script
```

---

## License

This project is open-source software licensed under the [MIT License](LICENSE).