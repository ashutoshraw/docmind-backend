import mongoose from 'mongoose';
import { env } from './env.js';
import dns from 'node:dns';

if (process.env.NODE_ENV === 'development') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};
