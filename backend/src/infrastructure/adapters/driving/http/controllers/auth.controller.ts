import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../../driven/persistence/prisma.client.js';
import { PrismaAuditRepository } from '../../../driven/persistence/prisma-audit-log.repository.js';
import { env } from '../../../../config/env.config.js';

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

const audit = new PrismaAuditRepository();

export class AuthController {
  public login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Correo y contraseña válidos son obligatorios.' });
      return;
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user ? await bcrypt.compare(password, user.password_hash).catch(() => false) : false;

    if (!user || !user.is_active || !passwordMatches) {
      await audit.appendLog({
        action: 'LOGIN_FAILURE', resource: 'AuthSession', ipAddress: req.ip || 'unknown',
        userAgent: req.header('user-agent') || 'unknown', details: { email },
      }).catch(() => undefined);
      res.status(401).json({ success: false, message: 'Credenciales incorrectas o cuenta inactiva.' });
      return;
    }

    const token = jwt.sign(
      { email: user.email, role: user.role, cedulaProfesional: user.cedula_profesional || undefined },
      env.JWT_ACCESS_SECRET,
      { subject: user.id, expiresIn: '8h' }
    );

    await audit.appendLog({
      userId: user.id, action: 'LOGIN_SUCCESS', resource: 'AuthSession',
      ipAddress: req.ip || 'unknown', userAgent: req.header('user-agent') || 'unknown',
    }).catch(() => undefined);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name,
          role: user.role, cedulaProfesional: user.cedula_profesional,
        },
      },
    });
  };
}

export const authController = new AuthController();
