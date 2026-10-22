import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getTelemetrySignature } from './telemetry.js';
import { correlateGitHubDeployments } from './github.js';
import { fetchRunbookSteps } from './runbook.js';
import { assertReadOnlyScope } from '../security/prm.js';
import { logger } from '../utils/logger.js';

export function registerMcpTools(mcpServer: Server): void {
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_telemetry_signature',
          description: 'Queries Prometheus telemetry for anomaly inflection timestamps, baseline vs current 5xx rates.',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string', description: 'Name of the microservice (e.g. auth-service)' },
              timeWindowMinutes: { type: 'number', description: 'Historical analysis window in minutes' }
            },
            required: ['service']
          }
        },
        {
          name: 'correlate_github_deployments',
          description: 'Correlates commits and merged pull requests against the inflection window and extracts parsed unified diffs.',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string', description: 'Name of the service to inspect' },
              timeWindowMinutes: { type: 'number', description: 'Inspection window in minutes' }
            },
            required: ['service']
          }
        },
        {
          name: 'fetch_runbook_steps',
          description: 'Scans checked-in repository Markdown runbooks and returns ordered mitigation steps.',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string', description: 'Target microservice name' },
              errorSignature: { type: 'string', description: 'Identified exception signature or status' }
            },
            required: ['service']
          }
        },
        {
          name: 'remediate_or_rollback',
          description: 'Attempts an active mutation or deployment rollback (strictly guarded by RFC 9728 PRM).',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string', description: 'Target microservice name' },
              action: { type: 'string', description: 'Mutating action to execute (e.g. rollback, restart)' }
            },
            required: ['service', 'action']
          }
        }
      ]
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`MCP Tool Call Dispatched: ${name}`, { args });

    try {
      assertReadOnlyScope(name);

      if (name === 'get_telemetry_signature') {
        const service = String(args?.service || 'auth-service');
        const window = Number(args?.timeWindowMinutes || 30);
        const result = await getTelemetrySignature(service, window);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      if (name === 'correlate_github_deployments') {
        const service = String(args?.service || 'auth-service');
        const window = Number(args?.timeWindowMinutes || 45);
        const result = await correlateGitHubDeployments(service, window);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      if (name === 'fetch_runbook_steps') {
        const service = String(args?.service || 'auth-service');
        const errorSig = String(args?.errorSignature || '');
        const result = fetchRunbookSteps(service, errorSig);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      if (name === 'remediate_or_rollback') {
        assertReadOnlyScope(String(args?.action || 'rollback'));
        return {
          isError: true,
          content: [{ type: 'text', text: 'Forbidden.' }]
        };
      }

      throw new Error(`Unknown MCP Tool: ${name}`);
    } catch (err: any) {
      logger.error(`Tool Execution Error in ${name}: ${err.message}`);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: err.code || 'TOOL_EXECUTION_ERROR',
              message: err.message,
              read_only_boundary_enforced: true
            })
          }
        ]
      };
    }
  });
}
