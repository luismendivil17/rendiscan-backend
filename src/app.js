import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import router from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import facturasUploadRouter from './routes/sub/facturas.upload.routes.js';
import { requireAuth } from './middlewares/auth.middleware.js';


import path from 'node:path';

const app = express();

app.use(cors({
  origin: true,          
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(morgan('dev'));

app.get('/', (_req, res) => res.send('RendiScan API OK'));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'storage', 'uploads')));

app.use('/api/rendiciones/:rendicionId/factura', requireAuth, facturasUploadRouter);



app.use('/api', router);

app.use(errorMiddleware);

export default app;
