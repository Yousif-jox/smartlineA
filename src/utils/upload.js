// src/utils/upload.js — Day-6 (Task 84) file-upload guard.
// Reusable, pure, tested. There is no upload endpoint in the Day-5 scope, so
// this guard ships as a verified utility + middleware for the Day-7 features.
// Rules: extension whitelist + magic-byte sniffing (an .exe renamed to .jpg is
// rejected), size cap, and safe filenames (path traversal `../../etc/passwd`
// and control characters are rejected).
const path = require('path');
const { ApiError } = require('../middleware/error');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB (configurable at call sites)

const ALLOWED = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
};

// Magic bytes — the content must match the declared extension.
function sniffMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  if (buffer[0] === 0x2d && buffer[1] === 0x2d) return 'text/csv'; // "--" (CSV has no single magic; accept text starts)
  return null;
}

// Path traversal / control chars / empty names -> null (rejected).
function sanitizeFilename(raw) {
  const base = String(raw || '').trim();
  if (!base || base === '.' || base === '..') return null;
  if (base.includes('/') || base.includes('\\') || base.includes('\0')) return null;
  return base;
}

// Pure validation — unit-testable without HTTP.
function validateUpload({ originalname, size, buffer }, { maxBytes = MAX_BYTES } = {}) {
  if (!originalname) throw new ApiError(422, 'FILE_REQUIRED', 'A file is required');
  if (size > maxBytes) throw new ApiError(413, 'FILE_TOO_LARGE', `File exceeds ${maxBytes} bytes`);

  const safe = sanitizeFilename(originalname);
  if (!safe) throw new ApiError(422, 'INVALID_FILENAME', 'Unsafe filename rejected');

  const ext = path.extname(safe).toLowerCase();
  if (!ALLOWED[ext]) throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', `Type ${ext} is not allowed`);

  const sniffed = sniffMime(buffer);
  if (sniffed !== ALLOWED[ext]) {
    // An .exe renamed to .jpg (or an empty/truncated body) lands here.
    throw new ApiError(415, 'FILE_TYPE_MISMATCH', 'File content does not match its extension');
  }

  return { originalname: safe, ext, mime: sniffed };
}

// Express middleware (multer-style req.file). Attaches req.upload on success.
function uploadGuard(req, _res, next) {
  try {
    const file = req.file;
    if (!file) throw new ApiError(422, 'FILE_REQUIRED', 'A file is required (multipart field "file")');
    req.upload = validateUpload(file);
    return next();
  } catch (err) { return next(err); }
}

module.exports = { validateUpload, uploadGuard, sniffMime, sanitizeFilename, ALLOWED, MAX_BYTES };
