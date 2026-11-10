import { NodeCryptoEncryptionAdapter } from '../adapters/driven/security/node-crypto-encryption.adapter.js';
import { PrismaConsultationRepository } from '../adapters/driven/persistence/prisma-consultation.repository.js';
import { PrismaAuditRepository } from '../adapters/driven/persistence/prisma-audit-log.repository.js';
import { InMemoryConsultationRepository } from '../adapters/driven/persistence/in-memory-consultation.repository.js';
import { InMemoryAuditRepository } from '../adapters/driven/persistence/in-memory-audit.repository.js';
import { CreateSoapConsultationUseCase } from '../../core/application/use-cases/consultations/create-soap-consultation.usecase.js';
import { SignSoapConsultationUseCase } from '../../core/application/use-cases/consultations/sign-soap-consultation.usecase.js';
import { ConsultationsController } from '../adapters/driving/http/controllers/consultations.controller.js';
import { env } from './env.config.js';

// Instancias de infraestructura (Driven Adapters)
export const encryptionAdapter = new NodeCryptoEncryptionAdapter(env.CLINICAL_FLE_MASTER_KEY);

// Repositorios PostgreSQL con Prisma ORM (Persistencia real en base de datos)
export const consultationRepo = new PrismaConsultationRepository();
export const auditRepo = new PrismaAuditRepository();

// Repositorios de memoria (alternativa para testing unitario desacoplado)
export const inMemoryConsultationRepo = new InMemoryConsultationRepository();
export const inMemoryAuditRepo = new InMemoryAuditRepository();

// Casos de uso (Application Layer)
export const createSoapUseCase = new CreateSoapConsultationUseCase(consultationRepo, encryptionAdapter, auditRepo);
export const signSoapUseCase = new SignSoapConsultationUseCase(consultationRepo, auditRepo);

// Controladores (Driving Adapters)
export const consultationsController = new ConsultationsController(
  createSoapUseCase,
  signSoapUseCase,
  consultationRepo,
  encryptionAdapter
);
