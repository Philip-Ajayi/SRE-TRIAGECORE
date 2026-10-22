#!/usr/bin/env bash
set -e

echo "========================================================="
echo "   STARTING SRE TRIAGECORE ALL-IN-ONE CONTAINER STACK    "
echo "========================================================="

# 1. Start Auth Service Simulator on port 4000
echo "[1/4] Starting auth-service microservice..."
node simulator/auth-service/server.js &

# 2. Start Synthetic Traffic Generator
echo "[2/4] Starting continuous synthetic traffic generator..."
TARGET_URL=http://127.0.0.1:4000/login REQUEST_INTERVAL_MS=200 node simulator/traffic-generator/generator.js &

# 3. Start Prometheus on port 9090
echo "[3/4] Starting Prometheus metrics engine..."
mkdir -p /tmp/prometheus
prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/tmp/prometheus &

# Wait for background services to bind ports
echo "Waiting for internal simulator services to initialize..."
for i in {1..15}; do
  if curl -sf http://127.0.0.1:4000/health > /dev/null 2>&1 && curl -sf http://127.0.0.1:9090/-/healthy > /dev/null 2>&1; then
    echo "✓ Internal simulator and metrics engine are online."
    break
  fi
  sleep 1
done

# 4. Start Main MCP Server & Web Console
PORT=${PORT:-8080}
HOST="0.0.0.0"

echo "[4/4] Starting SRE TriageCore Express MCP server on port $PORT..."
exec node dist/index.js