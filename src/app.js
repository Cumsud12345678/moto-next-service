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
import metadataRoutes from "./routes/metadata/metadata.routes.js";


const app = express()

app.set('trust proxy', true);
app.use(cookieParser());
app.use(errorMiddleware);

dotenv.config();

const allowedOrigins = [
  'https://moto-next.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman kimi alətlər üçün

    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS icazəsi yoxdur: ' + origin));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }))

connectDB()

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/metadata', metadataRoutes)

const startServer = async () => {
  await connectDB()

  app.listen(5000, () => {
    console.log('Server running on port 5000')
  })
}

startServer()