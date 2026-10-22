---
service: payment-gateway
title: Payment Gateway Degraded State Playbook
severity: P1-CRITICAL
owner: checkout-platform
escalation_channel: "#oncall-checkout"
error_signatures:
  - GatewayTimeoutException
  - StripeDownstream504
---

# Payment Gateway Playbook

## Overview
Handles tokenized credit card transactions and downstream payment provider webhooks.

## Mitigation Steps
1. Verify downstream acquirer latency on Stripe/Adyen status pages.
2. Flip feature flag `checkout.circuit_breaker.fallback` to enable asynchronous checkout queueing.
3. Drain stuck payment gateway worker pods via standard blue/green deployment strategy.
