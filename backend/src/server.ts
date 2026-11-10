import { app } from './app.js';
import { env } from './infrastructure/config/env.config.js';
import { DatabaseConnection } from './infrastructure/adapters/driven/persistence/prisma.client.js';
import { startNotificationWorker, stopNotificationWorker } from './infrastructure/notifications/notification.service.js';

async function bootstrap() {
  try {
    // Inicializar conexión Singleton a PostgreSQL
    await DatabaseConnection.connect();
    startNotificationWorker();

    const server = app.listen(env.PORT, () => {
      console.log(`[JDClinic] Servidor iniciado en http://localhost:${env.PORT}`);
      console.log(`[JDClinic] Modo: ${env.NODE_ENV}`);
      console.log(`[JDClinic] Cifrado FLE (AES-256-GCM) inicializado y verificado.`);
    });

    // Cierre ordenado
    const handleShutdown = async () => {
      stopNotificationWorker();
      console.log('\n[JDClinic] Cerrando servidor y conexiones...');
      server.close(async () => {
        await DatabaseConnection.disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
  } catch (error) {
    console.error('[JDClinic] Fallo crítico al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();

