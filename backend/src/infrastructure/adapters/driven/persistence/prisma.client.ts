import { PrismaClient } from '@prisma/client';

/**
 * Patrón Singleton para la conexión a la base de datos PostgreSQL mediante Prisma ORM.
 * Asegura una única instancia del pool de conexiones en toda la aplicación (Driven Adapter).
 */
export class DatabaseConnection {
  private static instance: PrismaClient | null = null;

  private constructor() {}

  /**
   * Obtiene la instancia única de PrismaClient (Singleton).
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return DatabaseConnection.instance;
  }

  /**
   * Inicializa la conexión con PostgreSQL y valida el estado.
   */
  public static async connect(): Promise<PrismaClient> {
    const client = DatabaseConnection.getInstance();
    try {
      await client.$connect();
      console.log('conexión a base de datos conectada');
      return client;
    } catch (error) {
      console.error('Error al conectar a la base de datos PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Cierra ordenadamente la conexión con la base de datos (Graceful Shutdown).
   */
  public static async disconnect(): Promise<void> {
    if (DatabaseConnection.instance) {
      await DatabaseConnection.instance.$disconnect();
      DatabaseConnection.instance = null;
      console.log('Conexión a base de datos cerrada.');
    }
  }
}

export const prisma = DatabaseConnection.getInstance();
