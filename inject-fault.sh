#!/usr/bin/env bash
set -euo pipefail

echo ">>> INJECTING FAULT: Throttling auth-service connection pool to 5 sockets (PR #412 simulation)..."
curl -s -X POST http://localhost:4000/chaos/inject | jq . || curl -s -X POST http://localhost:4000/chaos/inject

echo ""
echo "✓ Fault injected successfully."
echo "Traffic generator is now hitting auth-service, producing 500 Internal Server Errors."
echo "Open http://localhost:8080 and click the voice trigger or say: 'Alexa, PagerDuty alert on auth-service'!"
