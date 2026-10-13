import User from '../models/User.js';
import Document from '../models/Document.js';
import { asyncHandler } from './errorHandler.js';

const GUEST_MAX_DOCS = 3;
const GUEST_MAX_BYTES = 3 * 1024 * 1024; // ~3 MB, includes a little form overhead

// Runs after `protect`. Regular users pass straight through; guests are
// limited in how many documents they can hold and how large each upload is.
export const enforceGuestLimits = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.userId).select('isGuest');
  if (!user?.isGuest) return next();

  const size = Number(req.headers['content-length']) || 0;
  if (size > GUEST_MAX_BYTES) {
    res.status(413);
    throw new Error('Guest uploads are limited to 3 MB. Sign up for a free account to upload up to 5 MB.');
  }

  const count = await Document.countDocuments({ owner: req.userId });
  if (count >= GUEST_MAX_DOCS) {
    res.status(403);
    throw new Error('Guests can keep up to 3 documents. Delete one or sign up for a free account.');
  }

  next();
});