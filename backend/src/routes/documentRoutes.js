import express from 'express';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { enforceGuestLimits } from '../middleware/guestLimits.js';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/documentController.js';

const router = express.Router();

router.use(protect); // every route below requires a valid access token

router.post('/', enforceGuestLimits, upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

export default router;
