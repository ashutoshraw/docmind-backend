import multer from 'multer';

// Memory storage: the file buffer lives in RAM just long enough to extract
// its text, then it's discarded — we never write uploaded files to disk,
// which keeps the server stateless and safe to redeploy anytime (important
// for Render's free tier, where the filesystem resets on every restart).
const storage = multer.memoryStorage();

const ALLOWED_MIMETYPES = ['application/pdf', 'text/plain'];
const MAX_FILE_SIZE_MB = 5;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error('Only PDF and plain text files are supported'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});
