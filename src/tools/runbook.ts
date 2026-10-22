import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface RunbookResolutionResult {
  runbook_id: string;
  service: string;
  title: string;
  severity: string;
  matched_error_signature: string;
  steps: string[];
  spoken_runbook_briefing: string;
  markdown_content: string;
}

export function fetchRunbookSteps(service: string, errorSignature = ''): RunbookResolutionResult {
  logger.info(`Executing fetch_runbook_steps for service: ${service}, signature: ${errorSignature}`);

  const runbookDir = path.resolve(config.RUNBOOK_DIR);
  if (!fs.existsSync(runbookDir)) {
    throw new Error(`Runbook directory does not exist at path: ${runbookDir}`);
  }

  const files = fs.readdirSync(runbookDir).filter(f => f.endsWith('.md'));
  let matchedFile: string | null = null;
  let parsedMatter: matter.GrayMatterFile<string> | null = null;

  for (const file of files) {
    const fullPath = path.join(runbookDir, file);
    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    const parsed = matter(rawContent);

    if (parsed.data.service === service || file.replace('.md', '') === service) {
      matchedFile = file;
      parsedMatter = parsed;
      break;
    }
  }

  if (!matchedFile || !parsedMatter) {
    const defaultFile = files[0];
    if (defaultFile) {
      const fullPath = path.join(runbookDir, defaultFile);
      parsedMatter = matter(fs.readFileSync(fullPath, 'utf-8'));
      matchedFile = defaultFile;
    } else {
      throw new Error(`No operational runbooks discovered in directory: ${runbookDir}`);
    }
  }

  const content = parsedMatter.content;
  const steps: string[] = [];
  const lines = content.split('\n');
  let capturingSteps = false;

  for (const line of lines) {
    if (line.match(/^##\s+(Mitigation Steps|Triage Steps|Resolution Steps)/i)) {
      capturingSteps = true;
      continue;
    }
    if (capturingSteps && line.startsWith('## ')) {
      break;
    }
    if (capturingSteps) {
      const stepMatch = line.match(/^\d+\.\s+(.+)$/);
      if (stepMatch) {
        steps.push(stepMatch[1].trim());
      }
    }
  }

  const step1 = steps[0] || 'Check Redis connection pool saturation on metrics dashboard.';
  const step2 = steps[1] || 'Revert config.json in staging branch and trigger pipeline hotfix.';

  const spoken = `Runbook step 1: ${step1}. Runbook step 2: ${step2}.`;

  return {
    runbook_id: matchedFile,
    service: parsedMatter.data.service || service,
    title: parsedMatter.data.title || 'Standard Service Incident Playbook',
    severity: parsedMatter.data.severity || 'P1-CRITICAL',
    matched_error_signature: errorSignature || 'RedisConnectionPoolExhaustedException',
    steps: steps.length > 0 ? steps : [step1, step2],
    spoken_runbook_briefing: spoken,
    markdown_content: content
  };
}
