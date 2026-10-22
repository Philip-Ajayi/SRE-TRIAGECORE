import { getTelemetrySignature } from '../tools/telemetry.js';
import { correlateGitHubDeployments } from '../tools/github.js';
import { fetchRunbookSteps } from '../tools/runbook.js';
import { logger } from '../utils/logger.js';

export interface AmbientTriageResponse {
  spoken_response: string;
  terminal_report: {
    service: string;
    telemetry: {
      inflection_relative: string;
      current_error_percentage: number;
      baseline_error_percentage: number;
    };
    root_cause_pr: {
      pr_number: number;
      author: string;
      merged_relative: string;
      unified_diff: string;
    };
    runbook: {
      title: string;
      step_1: string;
      step_2: string;
    };
  };
}

export async function executeAmbientVoiceTriage(service: string): Promise<AmbientTriageResponse> {
  logger.info(`Initiating ambient voice incident diagnostics pipeline for [${service}]`);

  const [telemetry, deployment] = await Promise.all([
    getTelemetrySignature(service, 30),
    correlateGitHubDeployments(service, 45)
  ]);

  const runbook = fetchRunbookSteps(
    service,
    telemetry.anomaly_detected ? 'RedisConnectionPoolExhaustedException' : ''
  );

  const errorRate = telemetry.current_error_percentage;
  const inflectionTime = telemetry.inflection_relative_time;
  const prNum = deployment.pull_request_number;
  const author = deployment.author;
  const prMergedTime = deployment.merged_relative_time;
  const step1 = runbook.steps[0] || 'Check connection pool telemetry.';
  const step2 = runbook.steps[1] || 'Revert breaking configuration.';

  const spoken_response = `${service} 500 error rate spiked to ${errorRate}% starting ${inflectionTime}. Root cause correlation: ${deployment.root_cause_summary} Runbook step 1: ${step1}. Runbook step 2: ${step2}. Full incident report dispatched to your terminal.`;

  return {
    spoken_response,
    terminal_report: {
      service,
      telemetry: {
        inflection_relative: inflectionTime,
        current_error_percentage: errorRate,
        baseline_error_percentage: telemetry.baseline_error_percentage
      },
      root_cause_pr: {
        pr_number: prNum,
        author,
        merged_relative: prMergedTime,
        unified_diff: deployment.unified_diff
      },
      runbook: {
        title: runbook.title,
        step_1: step1,
        step_2: step2
      }
    }
  };
}
