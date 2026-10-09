import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import { askQuestion, getChatHistory } from '../controllers/chatController.js';

const router = express.Router();

router.use(protect);

// Each question triggers 2 Gemini API calls (embed + generate), so this is
// rate-limited more tightly than general routes to stay within free-tier quota.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many questions, please wait a moment before asking again' },
});

router.post('/:documentId', chatLimiter, askQuestion);
router.get('/:documentId/history', getChatHistory);

export default router;
