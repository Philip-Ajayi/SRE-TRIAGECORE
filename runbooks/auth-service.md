---
service: auth-service
title: Authentication Service Incident Diagnostic Playbook
severity: P1-CRITICAL
owner: core-identity-team
escalation_channel: "#oncall-identity-ops"
error_signatures:
  - RedisConnectionPoolExhaustedException
  - "500 Internal Server Error"
  - "SocketTimeoutException: Redis acquire timeout"
---

# Authentication Service Playbook (auth-service)

## Overview
The `auth-service` issues JWT tokens for all incoming web requests. It uses Redis cluster nodes for caching refresh sessions and rate-limit metadata.

## Diagnostic Checklist
- [ ] Verify Prometheus metric `sum(rate(http_requests_total{service="auth-service",status=~"5.."}[1m]))`
- [ ] Inspect upstream Redis memory utilization and client connection saturation.
- [ ] Correlate recent Git merges modifying `src/config/redis.json`.

## Mitigation Steps
1. Check Redis connection pool exhaustion on dashboard and verify active sockets vs pool limit.
2. Revert config.json in staging branch and trigger pipeline hotfix to restore max_connections to 50.
3. If error rates exceed 20% for > 15 minutes, page secondary on-call engineer at `#oncall-identity-ops`.

## Verification Steps
- Run `curl -v http://auth-service:4000/health`
- Check Prometheus error rate drops to < 0.1% within 90 seconds of pool adjustment.
