// Day 6 — file-upload guard tests (Task 84): type/size/name safety.
const { test } = require('node:test');
const assert = require('node:assert');
const { validateUpload, sanitizeFilename, sniffMime } = require('../../../src/utils/upload');

const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

test('valid jpg passes with sniffed mime', () => {
  const r = validateUpload({ originalname: 'photo.jpg', size: jpg.length, buffer: jpg });
  assert.strictEqual(r.ext, '.jpg');
  assert.strictEqual(r.mime, 'image/jpeg');
});

test('an .exe renamed to .jpg is REJECTED (magic bytes mismatch)', () => {
  assert.throws(
    () => validateUpload({ originalname: 'virus.jpg', size: exe.length, buffer: exe }),
    (e) => e.status === 415 && e.code === 'FILE_TYPE_MISMATCH',
  );
});

test('path traversal filename is REJECTED', () => {
  assert.throws(
    () => validateUpload({ originalname: '../../etc/passwd.jpg', size: jpg.length, buffer: jpg }),
    (e) => e.status === 422 && e.code === 'INVALID_FILENAME',
  );
  assert.throws(
    () => validateUpload({ originalname: '..\\..\\win.ini.png', size: png.length, buffer: png }),
    (e) => e.status === 422 && e.code === 'INVALID_FILENAME',
  );
});

test('NUL byte / dot / empty filenames are REJECTED', () => {
  assert.strictEqual(sanitizeFilename('a\0b.png'), null);
  assert.strictEqual(sanitizeFilename('.'), null);
  assert.strictEqual(sanitizeFilename('..'), null);
  assert.strictEqual(sanitizeFilename(''), null);
  assert.throws(() => validateUpload({ originalname: undefined, size: 1, buffer: jpg }), (e) => e.code === 'FILE_REQUIRED');
});

test('oversized file -> 413 FILE_TOO_LARGE', () => {
  assert.throws(
    () => validateUpload({ originalname: 'big.pdf', size: 6 * 1024 * 1024, buffer: pdf }, { maxBytes: 5 * 1024 * 1024 }),
    (e) => e.status === 413 && e.code === 'FILE_TOO_LARGE',
  );
});

test('disallowed extension -> 415 UNSUPPORTED_FILE_TYPE', () => {
  assert.throws(
    () => validateUpload({ originalname: 'script.js', size: 10, buffer: Buffer.from('var x') }),
    (e) => e.status === 415 && e.code === 'UNSUPPORTED_FILE_TYPE',
  );
});

test('sniffMime returns null for unknown content', () => {
  assert.strictEqual(sniffMime(Buffer.from([0x01, 0x02, 0x03])), null);
  assert.strictEqual(sniffMime(Buffer.alloc(0)), null);
});

test('sanitizeFilename strips surrounding whitespace but keeps safe names', () => {
  assert.strictEqual(sanitizeFilename('  report.pdf  '), 'report.pdf');
  assert.strictEqual(sanitizeFilename('report.pdf'), 'report.pdf');
});
