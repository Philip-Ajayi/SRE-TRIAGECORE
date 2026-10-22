#!/usr/bin/env bash
set -euo pipefail

echo ">>> RESETTING FAULT: Restoring auth-service Redis connection pool to 50 sockets..."
curl -s -X POST http://localhost:4000/chaos/reset | jq . || curl -s -X POST http://localhost:4000/chaos/reset
echo ""
echo "✓ Service restored to normal operation."
