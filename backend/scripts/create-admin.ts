import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const email = process.env.JDCLINIC_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.JDCLINIC_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
  console.error('Configura JDCLINIC_ADMIN_EMAIL y JDCLINIC_ADMIN_PASSWORD (mínimo 12 caracteres).');
  process.exit(2);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.error('La cuenta ya existe; no se cambiará su contraseña.');
    process.exitCode = 1;
  } else {
    await prisma.user.create({ data: {
      email, password_hash: await bcrypt.hash(password, 12),
      first_name: 'Administración', last_name: 'JDClinic', role: 'ADMINISTRADOR',
    } });
    console.log('Cuenta administrativa inicial creada.');
  }
} finally {
  await prisma.$disconnect();
}

