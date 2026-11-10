import dotenv from 'dotenv';
import { z } from 'zod';

// En desarrollo, la configuración del proyecto prevalece sobre variables
// heredadas de otras aplicaciones locales (por ejemplo, otro webhook n8n).
dotenv.config({ override: process.env.NODE_ENV !== 'production' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEPLOYMENT_MODE: z.enum(['managed-rds', 'academy-ec2']).default('managed-rds'),
  PORT: z.string().default('4000').transform(Number),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/expediente_clinico_db?schema=public'),
  CLINICAL_FLE_MASTER_KEY: z.string().length(64).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  JWT_ACCESS_SECRET: z.string().min(16).default('test_jwt_secret_key_minimum_length_safe_123'),
  JWT_REFRESH_SECRET: z.string().min(16).default('test_refresh_secret_key_minimum_length_safe_456'),
  FRONTEND_URL: z.string().url().default('http://localhost:5175'),
  PRESCRIPTION_SIGNING_KEY: z.string().min(32).optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_S3_KMS_KEY_ID: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),
  CLINIC_TIME_ZONE: z.string().default('America/Mexico_City'),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  const required = [
    'DATABASE_URL', 'CLINICAL_FLE_MASTER_KEY', 'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET', 'PRESCRIPTION_SIGNING_KEY',
    'N8N_WEBHOOK_URL', 'N8N_WEBHOOK_SECRET',
  ] as const;
  for (const name of required) {
    const actual = process.env[name];
    if (!actual || /example|replace|tudominio|test_|0123456789abcdef/i.test(actual)) {
      context.addIssue({ code: 'custom', path: [name], message: `${name} debe configurarse para producción.` });
    }
  }
  if (value.DEPLOYMENT_MODE === 'managed-rds' && !value.AWS_S3_BUCKET_NAME) {
    context.addIssue({ code: 'custom', path: ['AWS_S3_BUCKET_NAME'], message: 'Configura S3 en el despliegue administrado.' });
  }
  if (value.DEPLOYMENT_MODE === 'managed-rds' && !value.FRONTEND_URL.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'El frontend de producción requiere HTTPS.' });
  }
  if (value.DEPLOYMENT_MODE === 'managed-rds' && !value.DATABASE_URL.includes('sslmode=require')) {
    context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'La conexión a RDS debe exigir TLS.' });
  }
});

export const env = envSchema.parse(process.env);
