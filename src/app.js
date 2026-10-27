import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import { redis } from './config/redis.config.js'
import { errorMiddleware } from './middlewares/error.middleware.js';
import { admin } from './middlewares/admin.middleware.js';
import { logError } from './services/system/errorLog.service.js'
import { startJobs } from './jobs/index.js'

// routerler
import authRoutes from "./routes/auth/auth.routes.js";
import listingRoutes from "./routes/user/listing.routes.js";
import userRoutes from "./routes/user/user.routes.js";
import metadataRoutes from "./routes/metadata.routes.js";
import messageRoutes from "./routes/user/message.routes.js";
import makeRequestRoutes from './routes/metadata/makeRequest.routes.js'
import partRoutes from './routes/user/part.routes.js'
import { seedPartCategories } from './models/part/partCategory.model.js'

import adminUserRoutes from './routes/admin/adminUser.routes.js'
import adminListingRoutes from './routes/admin/adminListing.routes.js'
import groupRoutes from './routes/admin/group.routes.js'
import adsenseRoutes from './routes/admin/adsense.routes.js'
import adminMakeRequestRoutes from './routes/admin/makeRequest.routes.js'
import adminErrorLogRoutes from './routes/admin/errorLog.routes.js'
import adminStatsRoutes from './routes/admin/stats.routes.js'
import adminReportRoutes from './routes/admin/report.routes.js'
import adminPartRoutes from './routes/admin/adminPart.routes.js'

// Bunlar olmadan server düzgün işləyə bilməz — başlamadan yoxlayırıq
const REQUIRED_ENV = ['MONGO_URL', 'JWT_SECRET', 'REDIS_URL']
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key])
if (missingEnv.length) {
  console.error(`Env dəyişənləri yoxdur: ${missingEnv.join(', ')}`)
  process.exit(1)
}

const app = express()

// Sorğular Vercel (rewrite) və Render proxy-lərindən keçir — istifadəçinin real IP-si X-Forwarded-For-dadır
app.set('trust proxy', true);
app.disable('x-powered-by');

// Təhlükəsizlik başlıqları (API JSON qaytarır, CSP lazım deyil)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cookieParser());

const allowedOrigins = [
  'https://moto-next.vercel.app',
  'http://localhost:3000',
  'https://motoelan.com',
  'https://www.motoelan.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman, server-side fetch və s.

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const error = new Error('CORS icazəsi yoxdur: ' + origin)
      error.statusCode = 403 // 500 deyil: bu server xətası deyil, loqlanmasın
      callback(error);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }))

// Render health check və UptimeRobot üçün: DB və Redis vəziyyəti də görünür
app.get('/api/health', (req, res) => {
  const db = mongoose.connection.readyState === 1
  res.status(db ? 200 : 503).json({ ok: db, db, redis: redis.isReady });
});

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/metadata', metadataRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/adsense', adsenseRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/make-requests', makeRequestRoutes)
app.use('/api/parts', partRoutes)

app.use('/api/admin/users', admin, adminUserRoutes)
app.use('/api/admin/listings', admin, adminListingRoutes)
app.use('/api/admin/make-requests', admin, adminMakeRequestRoutes)
app.use('/api/admin/error-logs', admin, adminErrorLogRoutes)
app.use('/api/admin/stats', admin, adminStatsRoutes)
app.use('/api/admin/reports', admin, adminReportRoutes)
app.use('/api/admin/parts', admin, adminPartRoutes)

// Mövcud olmayan endpoint — HTML əvəzinə JSON 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tapılmadı' })
})

app.use(errorMiddleware);

// Express-dən kənarda baş verən xətalar (await edilməmiş promise-lər və s.)
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logError(err, { source: 'process', context: 'unhandledRejection', statusCode: 500 })
})

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err)
  // Proses qeyri-sabit vəziyyətdədir: loqu yazıb çıxırıq, Render serveri yenidən başladır
  Promise.race([
    logError(err, { source: 'process', context: 'uncaughtException', statusCode: 500 }),
    new Promise((r) => setTimeout(r, 3000)),
  ]).finally(() => process.exit(1))
})

const PORT = Number(process.env.PORT) || 5000

const startServer = async () => {
  // ƏVVƏL: connectDB iki dəfə çağırılırdı (biri gözlənilmədən)
  await connectDB()
  await seedPartCategories()

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })

  startJobs()

  // Render deploy zamanı köhnə prosesə SIGTERM göndərir: yarımçıq sorğuları bitirib bağlanırıq
  const shutdown = async (signal) => {
    console.log(`${signal} alındı, server bağlanır...`)
    server.close(async () => {
      await Promise.allSettled([mongoose.connection.close(), redis.quit()])
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

startServer()
