import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  generateAccessToken,
  generateRefreshToken,
  cookieOptions,
} from '../utils/generateTokens.js';

// POST /api/auth/signup
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409);
    throw new Error('An account with this email already exists');
  }

  const user = await User.create({ name, email, password });

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Store a hash of the refresh token, not the raw token — same principle
  // as passwords. If the DB leaks, stored tokens are useless without the
  // original.
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);
  res.status(201).json({
    accessToken,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  res.cookie('refreshToken', refreshToken, cookieOptions);
  res.json({
    accessToken,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

// POST /api/auth/refresh — mints a new access token using the refresh cookie
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    res.status(401);
    throw new Error('No refresh token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    res.status(401);
    throw new Error('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.userId).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    res.status(401);
    throw new Error('Session no longer valid, please log in again');
  }

  const isValid = await bcrypt.compare(token, user.refreshTokenHash);
  if (!isValid) {
    res.status(401);
    throw new Error('Session no longer valid, please log in again');
  }

  const newAccessToken = generateAccessToken(user._id);
  res.json({ accessToken: newAccessToken });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
      await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
    } catch {
      // token already invalid/expired — nothing to clean up
    }
  }
  res.clearCookie('refreshToken', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me — used by the frontend on page load to check session
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ id: user._id, name: user.name, email: user.email });
});
