import { Request, Response, NextFunction } from 'express';
import { PrismaAuditRepository } from '../../../driven/persistence/prisma-audit-log.repository.js';

const rbacAudit = new PrismaAuditRepository();

export type Role = 'ADMINISTRADOR' | 'MEDICO_GENERAL' | 'MEDICO_ESPECIALISTA' | 'ENFERMERIA' | 'RECEPCION';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  cedulaProfesional?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireRole = (allowedRoles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado: Se requiere token de sesión activo.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      await rbacAudit.appendLog({ userId: req.user.id, action: 'UNAUTHORIZED_ACCESS_ATTEMPT', resource: req.baseUrl + req.path, ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown', details: { method: req.method, role: req.user.role, allowedRoles } }).catch(() => undefined);
      res.status(403).json({
        success: false,
        message: `Acceso denegado: El rol [${req.user.role}] no tiene autorización para esta operación clínica.`,
      });
      return;
    }

    next();
  };
};
