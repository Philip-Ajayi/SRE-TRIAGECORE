import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  PROMETHEUS_URL: z.string().default('http://localhost:9090'),
  GITHUB_TOKEN: z.string().default('ghp_mock_token'),
  GITHUB_OWNER: z.string().default('acme-corp'),
  GITHUB_REPO: z.string().default('cloud-platform'),
  RUNBOOK_DIR: z.string().default('./runbooks'),
  AUTH_SERVICE_URL: z.string().default('http://localhost:4000'),
  USE_MOCK_GITHUB: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export const config = envSchema.parse(process.env);
