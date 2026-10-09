import pdf from 'pdf-parse';

// Takes a file buffer (from multer's memory storage) and the file's mimetype,
// returns plain extracted text. Keeping this isolated means swapping in a
// better PDF parser later (e.g. for scanned/image PDFs needing OCR) only
// touches this one file.
export const extractText = async (buffer, mimetype) => {
  if (mimetype === 'application/pdf') {
    const result = await pdf(buffer);
    return result.text;
  }

  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
};
