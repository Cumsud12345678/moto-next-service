import 'dotenv/config'
import dotenv from "dotenv";
import express from 'express'
import { connectDB } from './config/db.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import cors from 'cors'
import cookieParser from 'cookie-parser';

// routerler
import authRoutes from "./routes/auth/auth.routes.js";
import listingRoutes from "./routes/user/listing.routes.js";
import userRoutes from "./routes/user/user.routes.js";
import metadataRoutes from "./routes/metadata.routes.js";
import messageRoutes from "./routes/user/message.routes.js";

import adminUserRoutes from './routes/admin/adminUser.routes.js'
import adminListingRoutes from './routes/admin/adminListing.routes.js'
import groupRoutes from './routes/admin/group.routes.js'
import adsenseRoutes from './routes/admin/adsense.routes.js'
import makeRequestRoutes from './routes/metadata/makeRequest.routes.js'
import adminMakeRequestRoutes from './routes/admin/makeRequest.routes.js'
import adminErrorLogRoutes from './routes/admin/errorLog.routes.js'
import adminStatsRoutes from './routes/admin/stats.routes.js'
import { logError } from './services/system/errorLog.service.js'

import { admin } from './middlewares/admin.middleware.js';

const app = express()

app.set('trust proxy', true);
app.use(cookieParser());

dotenv.config();

const allowedOrigins = [
  'https://moto-next.vercel.app',
  'http://localhost:3000',
  'https://motoelan.com',
  'https://www.motoelan.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman kimi alətlər üçün

    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
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

connectDB()

app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/metadata', metadataRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/adsense', adsenseRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/make-requests', makeRequestRoutes)

app.use('/api/admin/users', admin, adminUserRoutes)
app.use('/api/admin/listings', admin, adminListingRoutes)
app.use('/api/admin/make-requests', admin, adminMakeRequestRoutes)
app.use('/api/admin/error-logs', admin, adminErrorLogRoutes)
app.use('/api/admin/stats', admin, adminStatsRoutes)

app.use(errorMiddleware);

// Express-dən kənarda baş verən xətalar (await edilməmiş promise-lər, cron və s.)
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

const startServer = async () => {
  await connectDB()

  app.listen(5000, () => {
    console.log('Server running on port 5000')
  })
}

startServer()