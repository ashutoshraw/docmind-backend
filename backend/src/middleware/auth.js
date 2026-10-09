import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.userId = decoded.userId; // attach to request for controllers to use
    next();
  } catch (err) {
    // Expired vs invalid gets the same generic message on purpose —
    // don't leak which case it is to a potential attacker.
    return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
  }
};
