#!/usr/bin/env bash
set -euo pipefail

echo "========================================================"
echo "          BOOTSTRAPPING SRE TRIAGECORE ECOSYSTEM        "
echo "========================================================"

if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is required to launch the ecosystem."
    exit 1
fi

echo "[1/3] Building and starting containerized services via Docker Compose..."
docker compose down -v --remove-orphans || true
docker compose build
docker compose up -d

echo "[2/3] Waiting for Prometheus and auth-service to become healthy..."
for i in {1..20}; do
  if curl -sf http://localhost:8080/health > /dev/null && curl -sf http://localhost:4000/health > /dev/null; then
    echo "✓ All core services online."
    break
  fi
  sleep 1
done

echo "[3/3] System operational!"
echo ""
echo "--------------------------------------------------------"
echo " Web Client Harness:     http://localhost:8080"
echo " MCP Streamable SSE:     http://localhost:8080/sse"
echo " RFC 9728 PRM Metadata:  http://localhost:8080/.well-known/oauth-protected-resource"
echo " Prometheus Scraper:     http://localhost:9090"
echo " auth-service Endpoint:  http://localhost:4000/health"
echo "--------------------------------------------------------"
echo "Run './inject-fault.sh' to trigger the 3:00 AM Redis pool incident drill."
