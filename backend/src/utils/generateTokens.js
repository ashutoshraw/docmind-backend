import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Access token: short-lived, sent with every request, proves identity.
export const generateAccessToken = (userId) =>
  jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRY,
  });

// Refresh token: long-lived, stored only in an httpOnly cookie, used solely
// to mint new access tokens once they expire. Kept separate so that even if
// an access token leaks (e.g. via XSS reading JS-accessible storage), the
// attacker only gets 15 minutes, not 7 days.
export const generateRefreshToken = (userId) =>
  jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRY,
  });

export const cookieOptions = {
  httpOnly: true, // JS on the page can't read it — blocks XSS token theft
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'strict', // blocks CSRF from other origins
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches refresh token expiry
};
