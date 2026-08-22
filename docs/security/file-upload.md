# File-Upload Security Guard (Day 6, Task 84)

## Context (honest)

The Day-5 scope has **no file-upload endpoint** — none of the 100 tasks
requires one, and adding an unrequested endpoint would be scope creep. Task 84
is therefore delivered as a **reusable, tested guard** (`src/utils/upload.js`)
that any Day-7 feature (avatar upload, trip evidence photos, complaint
attachments) mounts as middleware. The verification is at the unit level,
which is exactly where upload guards belong.

## The three attacks the guard blocks

1. **Executable disguised as an image** — `virus.exe` renamed `photo.jpg`.
   The guard sniffs **magic bytes** (`FF D8 FF` = JPEG, `89 50 4E 47` = PNG,
   `%PDF` = PDF) and compares against the declared extension:
   `415 FILE_TYPE_MISMATCH` on disagreement.
2. **Path traversal** — `../../etc/passwd` or `..\..\win.ini` as the filename.
   `sanitizeFilename()` rejects `/`, `\`, NUL, `.`, `..`, and empty names:
   `422 INVALID_FILENAME`. (Even so, production should never derive the
   storage path from the client name — store under a server-generated id.)
3. **Oversized uploads** — a 2 GiB "image" exhausts memory/disk:
   `413 FILE_TOO_LARGE` over the 5 MiB default (call-site configurable).

Plus: extension **whitelist** (`415 UNSUPPORTED_FILE_TYPE` for `.js`, `.exe`,
…), so an allowed-magic file with a weird extension is still rejected.

## API

```js
const { validateUpload, uploadGuard } = require('../utils/upload');
// pure: validateUpload({ originalname, size, buffer })
// middleware (multer-style req.file): uploadGuard -> req.upload
```

## Tests

`tests/unit/day6/file-upload-guard.test.js` — 9 cases: valid jpg, exe-as-jpg
rejected, path traversal (both slash directions), NUL/dot/empty names,
oversize, disallowed extension, unknown magic, whitespace trimming.

## Interview one-liner

> "Uploads are checked three ways: extension whitelist, magic-byte sniffing so
> an .exe renamed .jpg is rejected, and safe filenames so traversal dies at
> the boundary — plus a size cap. The guard is pure and unit-tested; it's a
> middleware any future upload endpoint mounts in one line."
