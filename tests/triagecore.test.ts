import assert from 'assert';
import axios from 'axios';
import { getTelemetrySignature } from '../src/tools/telemetry.js';
import { correlateGitHubDeployments } from '../src/tools/github.js';
import { fetchRunbookSteps } from '../src/tools/runbook.js';
import { assertReadOnlyScope } from '../src/security/prm.js';
import { executeAmbientVoiceTriage } from '../src/orchestrator/ambientVoiceTriage.js';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING SRE TRIAGECORE PRODUCTION VERIFICATION SUITE');
  console.log('====================================================\n');

  // Test 1: RFC 9728 Read-Only Enforcement
  console.log('[TEST 1] Verifying RFC 9728 Read-Only Boundary Enforcement...');
  assert.doesNotThrow(() => {
    assertReadOnlyScope('get_telemetry_signature');
    assertReadOnlyScope('correlate_github_deployments');
    assertReadOnlyScope('fetch_runbook_steps');
  }, 'Standard read-only tools must be permitted.');

  assert.throws(() => {
    assertReadOnlyScope('rollback_container');
  }, /denied/i, 'Write/rollback actions must throw RFC 9728 security violations.');

  assert.throws(() => {
    assertReadOnlyScope('restart_service');
  }, /denied/i, 'Restart mutation actions must be rejected.');
  console.log('✓ PASS: RFC 9728 Strictly Read-Only boundaries verified.\n');

  // Test 2: Runbook Markdown AST Parser
  console.log('[TEST 2] Verifying Runbook Markdown Frontmatter and Step Extraction...');
  const runbook = fetchRunbookSteps('auth-service', 'RedisConnectionPoolExhaustedException');
  assert.strictEqual(runbook.service, 'auth-service');
  assert(runbook.steps.length >= 2, 'Expected at least two mitigation steps.');
  assert(runbook.steps[0].toLowerCase().includes('redis'), 'Step 1 must reference Redis connection pool.');
  console.log('✓ PASS: Runbook resolution succeeded. Extracted steps:\n  1.', runbook.steps[0], '\n  2.', runbook.steps[1], '\n');

  // Test 3: GitHub Deployment Correlation and Diff Parsing
  console.log('[TEST 3] Verifying GitHub Deployment Correlation & Unified Diff Filter...');
  const deployment = await correlateGitHubDeployments('auth-service', 45);
  assert.strictEqual(deployment.pull_request_number, 412);
  assert.strictEqual(deployment.author, 'dev-alex');
  assert(deployment.unified_diff.includes('-  "max_connections": 50,'));
  assert(deployment.unified_diff.includes('+  "max_connections": 5,'));
  console.log('✓ PASS: Unified diff correlation accurately parsed Redis pool regression diff.\n');

  // Test 4: Telemetry Signature Extractor
  console.log('[TEST 4] Verifying Telemetry Signature PromQL Engine...');
  const telemetry = await getTelemetrySignature('auth-service', 30);
  assert(typeof telemetry.current_error_percentage === 'number');
  assert(telemetry.promql_query_used.includes('http_requests_total'));
  console.log(`✓ PASS: Telemetry extracted. Error rate: ${telemetry.current_error_percentage}%, Inflection: ${telemetry.inflection_relative_time}\n`);

  // Test 5: End-to-End Ambient Voice Orchestrator Pipeline
  console.log('[TEST 5] Verifying Full Ambient Voice Synthesis Pipeline...');
  const e2e = await executeAmbientVoiceTriage('auth-service');
  assert(e2e.spoken_response.includes('Auth-service 500 error rate spiked'));
  assert(e2e.spoken_response.includes('PR #412 by dev-alex'));
  assert(e2e.spoken_response.includes('Runbook step 1'));
  console.log('Synthesized Speech Briefing:\n', `"${e2e.spoken_response}"\n`);
  console.log('✓ PASS: Voice synthesis matches Phase 3 clinical specification.\n');

  console.log('====================================================');
  console.log('ALL VERIFICATION SUITE CHECKS PASSED SUCCESSFULLY (5/5)');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});
