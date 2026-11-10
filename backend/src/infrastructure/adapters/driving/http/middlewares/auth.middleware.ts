import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../../config/env.config.js';
import { AuthenticatedUser, Role } from './rbac.middleware.js';
import { prisma } from '../../../driven/persistence/prisma.client.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  cedulaProfesional?: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'La sesión es requerida.' });
    return;
  }

  try {
    const token = authorization.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    const activeUser = await prisma.user.findFirst({ where: { id: payload.sub, is_active: true }, select: { id: true, email: true, role: true, cedula_profesional: true } });
    if (!activeUser) { res.status(401).json({ success: false, message: 'La cuenta está inactiva o ya no existe.' }); return; }
    const user: AuthenticatedUser = {
      id: activeUser.id,
      email: activeUser.email,
      role: activeUser.role as Role,
      cedulaProfesional: activeUser.cedula_profesional || undefined,
    };
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'La sesión expiró o no es válida.' });
  }
}
