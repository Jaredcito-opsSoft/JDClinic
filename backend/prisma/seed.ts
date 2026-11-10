import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, RoleType, BiologicalSex, BloodType } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.env.DEV_SEED_EMAIL || 'medico@clinica.local';
const password = process.env.DEV_SEED_PASSWORD || 'Clinica2026!';
const adminEmail = process.env.DEV_ADMIN_EMAIL || 'admin@clinica.local';

try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { password_hash: passwordHash, is_active: true },
    create: {
      email, password_hash: passwordHash, first_name: 'Mariana', last_name: 'Salazar',
      cedula_profesional: '12345678', role: RoleType.MEDICO_GENERAL,
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail }, update: { password_hash: passwordHash, is_active: true },
    create: { email: adminEmail, password_hash: passwordHash, first_name: 'Administración', last_name: 'JDClinic', role: RoleType.ADMINISTRADOR },
  });

  await prisma.patient.upsert({
    where: { expediente_folio: 'EXP-2026-0001' },
    update: {},
    create: {
      expediente_folio: 'EXP-2026-0001', first_name: 'Elena', last_name: 'Morales Ruiz',
      birth_date: new Date('1988-05-14T00:00:00Z'), sex: BiologicalSex.FEMENINO,
      blood_type: BloodType.O_POSITIVO, phone: '9610000000', email: 'elena@example.local',
    },
  });

  console.log(`Datos de desarrollo listos. Usuario: ${email}`);
  console.log(`Administrador local: ${adminEmail}`);
  console.log('La contraseña se toma de DEV_SEED_PASSWORD (valor local por defecto documentado).');
} finally {
  await prisma.$disconnect();
}
