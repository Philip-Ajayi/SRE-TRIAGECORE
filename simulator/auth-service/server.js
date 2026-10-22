import express from 'express';
import client from 'prom-client';

const app = express();
app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests count partitioned by status code and service name',
  labelNames: ['service', 'status', 'endpoint'],
  registers: [register]
});

let isDegraded = false;
let degradedAt = null;
let maxConnections = 50;

app.get('/health', (_req, res) => {
  res.json({
    status: isDegraded ? 'DEGRADED' : 'HEALTHY',
    service: 'auth-service',
    max_connections: maxConnections,
    degradedAt
  });
});

app.post('/login', (_req, res) => {
  if (isDegraded) {
    httpRequestCounter.inc({ service: 'auth-service', status: '500', endpoint: '/login' });
    console.error('[auth-service] ERROR: RedisConnectionPoolExhaustedException: Pool size ' + maxConnections + ' exhausted. Timeout 500ms.');
    res.status(500).json({
      error: 'RedisConnectionPoolExhaustedException',
      message: 'Failed to acquire client connection from Redis pool (pool capacity ' + maxConnections + ' exhausted)',
      timestamp: new Date().toISOString()
    });
    return;
  }

  httpRequestCounter.inc({ service: 'auth-service', status: '200', endpoint: '/login' });
  res.status(200).json({
    status: 'authenticated',
    userId: 'user_' + Math.floor(Math.random() * 90000 + 10000),
    token: 'jwt.sample.token.triagecore'
  });
});

app.post('/chaos/inject', (_req, res) => {
  isDegraded = true;
  degradedAt = new Date().toISOString();
  maxConnections = 5;
  console.warn('[CHAOS] Injected fault: Redis connection pool throttled to 5 sockets. Errors spiking.');
  res.json({
    status: 'CHAOS_INJECTED',
    isDegraded,
    degradedAt,
    maxConnections
  });
});

app.post('/chaos/reset', (_req, res) => {
  isDegraded = false;
  degradedAt = null;
  maxConnections = 50;
  console.log('[CHAOS] Normal state restored: Redis pool restored to 50 connections.');
  res.json({
    status: 'RESTORED',
    isDegraded,
    maxConnections
  });
});

app.get('/chaos/status', (_req, res) => {
  res.json({
    isDegraded,
    degradedAt,
    maxConnections
  });
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

const PORT = 4000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[auth-service] Microservice listening on http://0.0.0.0:${PORT}`);
});

