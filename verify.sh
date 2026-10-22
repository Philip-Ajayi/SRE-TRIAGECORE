#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo "          RUNNING SRE TRIAGECORE INTEGRATION DRILL      "
echo "========================================================"

echo "[Step 1] Verifying RFC 9728 Protected Resource Metadata endpoint..."
curl -sf http://localhost:8080/.well-known/oauth-protected-resource | grep -q "sre:telemetry:read"
echo "✓ RFC 9728 Metadata successfully returned."

echo "[Step 2] Injecting synthetic Redis pool chaos..."
curl -sf -X POST http://localhost:4000/chaos/inject > /dev/null
sleep 2

echo "[Step 3] Testing MCP Ambient Voice Diagnostic Engine..."
RESPONSE=$(curl -sf -X POST http://localhost:8080/api/triage/ambient \
  -H "Content-Type: application/json" \
  -d '{"service":"auth-service"}')

echo "$RESPONSE" | grep -q "PR #412"
echo "$RESPONSE" | grep -q "dev-alex"
echo "✓ Incident briefing verified with telemetry and PR correlation."

echo "[Step 4] Testing RFC 9728 Prohibited Write Action Guard..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"tool":"remediate_or_rollback","arguments":{"service":"auth-service","action":"rollback_deployment"}}')

if [ "$HTTP_STATUS" -eq 403 ]; then
  echo "✓ RFC 9728 Guard blocked write operation with HTTP 403 Forbidden as required."
else
  echo "FAILED: Expected HTTP 403, received $HTTP_STATUS"
  exit 1
fi

echo "[Step 5] Resetting microservice..."
curl -sf -X POST http://localhost:4000/chaos/reset > /dev/null

echo ""
echo "========================================================"
echo "      ALL PRODUCTION ACCEPTANCE CRITERIA PASSED!        "
echo "========================================================"
