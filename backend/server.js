import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import authRoutes from './src/routes/authRoutes.js';
import documentRoutes from './src/routes/documentRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const app = express();

// Render (and most hosts) sit behind a reverse proxy. Without this, Express
// sees every request as coming from the proxy's internal IP, which breaks
// rate limiting (everyone would share one limit) and secure-cookie detection.
app.set('trust proxy', 4);

// --- Security & performance middleware ---
app.use(helmet()); // sets security-related HTTP headers (XSS protection, no-sniff, etc.)
app.use(compression()); // gzips responses, meaningfully speeds up JSON payloads over the network
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// General safety net: caps total requests per IP across the whole API, on
// top of the stricter per-route limits already on auth and chat. This stops
// someone from hammering, say, the document list endpoint in a loop.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);

// --- Health check (used by Render to confirm the service is alive) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

// --- Error handling (always last) ---
app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown: when the host sends SIGTERM (e.g. Render redeploying
  // or scaling down), finish in-flight requests instead of dropping them
  // mid-response, then exit cleanly.
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
};

// Last-resort safety nets: if something throws outside any try/catch or
// asyncHandler (a genuine bug), log it clearly instead of the process dying
// silently or Node printing an unhandled-rejection warning that gets missed
// in hosting logs.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1); // unknown state — safer to let the host restart the process
});

startServer();
