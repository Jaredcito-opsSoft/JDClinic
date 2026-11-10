import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiRouter } from './infrastructure/adapters/driving/http/routes/api.router.js';
import { env } from './infrastructure/config/env.config.js';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Rutas de API
app.use('/api/v1', apiRouter);

// Manejador 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Recurso no encontrado' });
});
