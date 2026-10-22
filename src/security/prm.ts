import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation: string;
  read_only_enforced: boolean;
  policy_statement: string;
}

export const RFC_9728_METADATA: ProtectedResourceMetadata = {
  resource: 'urn:sre:triagecore:mcp-gateway',
  authorization_servers: ['https://auth.acme-corp.internal/oauth/v2'],
  scopes_supported: [
    'sre:telemetry:read',
    'sre:source:read',
    'sre:runbook:read'
  ],
  bearer_methods_supported: ['header'],
  resource_documentation: 'https://docs.acme-corp.internal/specs/sre-triagecore-rfc9728',
  read_only_enforced: true,
  policy_statement: 'RFC 9728 Strict Read-Only Boundary. All mutate, write, rollback, and restart scopes are strictly forbidden by architectural constraint.'
};

export function prmMetadataHandler(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'max-age=3600');
  res.status(200).json(RFC_9728_METADATA);
}

export function assertReadOnlyScope(actionName: string): void {
  const disallowedPatterns = [
    'rollback',
    'restart',
    'terminate',
    'kill',
    'write',
    'delete',
    'patch',
    'update',
    'scale',
    'deploy'
  ];

  const lowerAction = actionName.toLowerCase();
  for (const pattern of disallowedPatterns) {
    if (lowerAction.includes(pattern)) {
      logger.warn('RFC 9728 Security Violation Attempt Intercepted', {
        action: actionName,
        enforcedBoundary: 'STRICT_READ_ONLY'
      });
      const error: any = new Error(
        `Rollback or mutation action denied: [${actionName}]. SRE TriageCore operates strictly under RFC 9728 read-only security scopes. Remediate via your authorized terminal.`
      );
      error.statusCode = 403;
      error.code = 'RFC_9728_WRITE_RESTRICTION_ENFORCED';
      throw error;
    }
  }
}

export function readOnlyEnforcementMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const targetTool = req.body?.params?.name || req.body?.tool || '';
    if (targetTool) {
      try {
        assertReadOnlyScope(targetTool);
      } catch (err: any) {
        res.status(403).json({
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: -32003,
            message: err.message,
            data: {
              rfc: 'RFC 9728 PRM',
              read_only_enforced: true,
              authorized_scopes: RFC_9728_METADATA.scopes_supported
            }
          }
        });
        return;
      }
    }
  }
  next();
}
