import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { prmMetadataHandler, readOnlyEnforcementMiddleware, assertReadOnlyScope } from './security/prm.js';
import { registerMcpTools } from './tools/registry.js';
import { executeAmbientVoiceTriage } from './orchestrator/ambientVoiceTriage.js';
import { getTelemetrySignature } from './tools/telemetry.js';
import { correlateGitHubDeployments } from './tools/github.js';
import { fetchRunbookSteps } from './tools/runbook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(readOnlyEnforcementMiddleware);

const mcpServer = new Server(
  {
    name: 'sre-triagecore',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

registerMcpTools(mcpServer);

let sseTransport: SSEServerTransport | null = null;

// RFC 9728 Protected Resource Metadata Endpoint
app.get('/.well-known/oauth-protected-resource', prmMetadataHandler);

// Streamable HTTP / Server-Sent Events (SSE) Transport
app.get('/sse', async (req, res) => {
  logger.info('Incoming MCP SSE stream connection established');
  sseTransport = new SSEServerTransport('/message', res);
  await mcpServer.connect(sseTransport);
});

app.post('/message', async (req, res) => {
  if (!sseTransport) {
    res.status(400).json({ error: 'SSE session has not been initialized.' });
    return;
  }
  await sseTransport.handlePostMessage(req, res);
});

// Ambient Voice Client Orchestration API
app.post('/api/triage/ambient', async (req, res) => {
  const service = req.body.service || 'auth-service';
  try {
    const result = await executeAmbientVoiceTriage(service);
    res.json(result);
  } catch (err: any) {
    logger.error('Ambient voice triage failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Direct Tool Execution Gateway (Fallback & Verification)
app.post('/api/tools/execute', async (req, res) => {
  const { tool, arguments: args } = req.body;
  try {
    assertReadOnlyScope(tool);
    if (args?.action) {
      assertReadOnlyScope(args.action);
    }

    if (tool === 'get_telemetry_signature') {
      const data = await getTelemetrySignature(args?.service || 'auth-service', args?.timeWindowMinutes || 30);
      res.json(data);
      return;
    }
    if (tool === 'correlate_github_deployments') {
      const data = await correlateGitHubDeployments(args?.service || 'auth-service', args?.timeWindowMinutes || 45);
      res.json(data);
      return;
    }
    if (tool === 'fetch_runbook_steps') {
      const data = fetchRunbookSteps(args?.service || 'auth-service', args?.errorSignature || '');
      res.json(data);
      return;
    }

    res.status(404).json({ error: `Tool ${tool} not found` });
  } catch (err: any) {
    res.status(err.statusCode || 403).json({
      error: err.code || 'RFC_9728_VIOLATION',
      message: err.message,
      read_only_enforced: true
    });
  }
});

// Chaos Injection and Reset Endpoints (Proxied to auth-service)
app.post('/api/chaos/inject', async (_req, res) => {
  try {
    const response = await axios.post(`${config.AUTH_SERVICE_URL}/chaos/inject`);
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chaos/reset', async (_req, res) => {
  try {
    const response = await axios.post(`${config.AUTH_SERVICE_URL}/chaos/reset`);
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    protocol: 'Model Context Protocol (Streamable HTTP)',
    security_architecture: 'RFC 9728 PRM Strictly Read-Only',
    timestamp: new Date().toISOString()
  });
});

// Serve Client Web Harness
const publicPath = path.resolve(__dirname, '../client/public');
app.use(express.static(publicPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(config.PORT, config.HOST, () => {
  logger.info(`SRE TriageCore Server listening on http://${config.HOST}:${config.PORT}`);
  logger.info(`RFC 9728 PRM Metadata: http://${config.HOST}:${config.PORT}/.well-known/oauth-protected-resource`);
  logger.info(`MCP Streamable SSE Endpoint: http://${config.HOST}:${config.PORT}/sse`);
});