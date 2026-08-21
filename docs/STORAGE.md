# File storage and attachments

```
browser ──multipart POST /api/uploads──▶ Next.js route (session required)
                                          │
                                          ├─ sniff bytes → allowlist → size limit
                                          ├─ scanner abstraction (currently SKIPPED)
                                          ├─ storage driver .put(opaque key)  ──▶ local disk | S3 / R2 / MinIO
                                          └─ Attachment row (owner, key, type, size, sha256)

browser ──GET /api/attachments/:id/content──▶ authorization check ──▶ presigned URL (s3) or streamed bytes (local)
```

The database row is the source of truth for ownership and authorization; the
object store only ever holds bytes under an opaque key.

## Drivers

`STORAGE_DRIVER` selects the driver.

| Driver | Use | Notes |
| --- | --- | --- |
| `local` | development, CI, tests | Writes under `STORAGE_LOCAL_ROOT` (default `./storage-data`, gitignored) plus a `.meta.json` sidecar. Cannot presign, so every read is streamed through the app. |
| `s3` | production | One code path for AWS S3, Cloudflare R2 and MinIO. Requires `STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`. |

`local` is **not** production storage: it is a single machine's filesystem with
no replication, no lifecycle rules and no shared access between app instances.

### Cloudflare R2

```env
STORAGE_DRIVER=s3
STORAGE_S3_BUCKET=dyne-uploads
STORAGE_S3_REGION=auto
STORAGE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_S3_ACCESS_KEY_ID=...      # R2 API token, Object Read & Write, one bucket
STORAGE_S3_SECRET_ACCESS_KEY=...
```

Do not attach a public `r2.dev` domain or a public bucket policy. The app is the
only reader.

### AWS S3

Same as above with `STORAGE_S3_REGION` set to the real region and
`STORAGE_S3_ENDPOINT` left empty. Block Public Access must stay on.

### MinIO (local S3-compatible testing)

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=dyne -e MINIO_ROOT_PASSWORD=dyne-secret \
  quay.io/minio/minio server /data --console-address ":9001"
```

```env
STORAGE_DRIVER=s3
STORAGE_S3_BUCKET=dyne-uploads
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_ACCESS_KEY_ID=dyne
STORAGE_S3_SECRET_ACCESS_KEY=dyne-secret
```

## Object keys

```
uploads/<year>/<month>/<ownerId>/<uuid>.<extension>
```

The user's filename is never part of the key — it is stored as metadata only.
Keys are validated (`assertSafeKey`) before every driver call, rejecting absolute
paths, empty segments and `.`/`..` traversal. The local driver additionally
verifies the resolved path stays inside its root.

## Validation

- The type is sniffed from magic bytes; the browser's `Content-Type` and the
  filename extension are ignored, and the canonical extension is derived from
  the sniffed type.
- Anything not on the allowlist is rejected, including HTML, SVG, scripts,
  shebang files and PE/ELF/Mach-O executables.
- Two size checks: the declared size and the actual byte length, against a
  global 100 MB cap and a per-type limit (images 25 MB, text 10 MB, audio 50 MB,
  documents/PDF 50 MB, video/archives 100 MB).
- Filenames are sanitized: directories stripped, control characters removed,
  length bounded, extension replaced with the sniffed one.
- Supported: JPEG, PNG, GIF, WebP, AVIF, MP4, MOV, WebM, MP3, WAV, OGG, FLAC,
  M4A, PDF, TXT, CSV, DOCX, XLSX, PPTX, ODT, ODS, DOC, ZIP, GZIP, 7z, RAR.

`GET /api/uploads` returns the limits and the picker `accept` string so client
validation cannot drift from the server's.

## Authorization

- An upload starts private to its owner.
- Attaching it to a message, DM or post is a claim that only succeeds if the
  caller owns the attachment and it is not already attached or deleted; from
  then on it inherits that resource's access rules (conversation members,
  channel members, community members).
- `GET /api/attachments/:id` and `/content` return 404 — not 403 — to anyone
  without access, so ids are not confirmed to strangers. Storage keys are not
  accepted in place of ids.
- Only the owner can delete. Deletion removes the bytes and soft-deletes the
  row; subsequent reads 404 for everyone.

## Response headers

Reads served by the app always send `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: default-src 'none'; sandbox`,
`Cross-Origin-Resource-Policy: same-origin` and `Cache-Control: private, no-store`.
Only images, audio and video may be `inline`; PDFs, documents, text and archives
are always `attachment`, and a client-requested disposition cannot override that.
Uploaded content is therefore never executed as application content.

## Malware scanning — not implemented

`src/lib/storage/scanner.ts` defines the `Scanner` interface and the app records
a real status per attachment, but no scanner is deployed. The default returns:

```json
{ "status": "SKIPPED", "scanner": "none" }
```

Every attachment stored today has `scanStatus = SKIPPED`. To make scanning real,
implement `Scanner` against a ClamAV (clamd) or hosted scanning service, register
it with `setScanner`, and decide the policy for `PENDING`/`INFECTED` files
(quarantine key prefix, deferred availability). Nothing in the product should
claim files are scanned until then.

## Verification status

- Local driver: implemented and verified by automated tests (`test/uploads.test.ts`,
  `test/storage-drivers.test.ts`).
- S3/R2/MinIO driver: implemented and verified against a mocked S3 client only —
  **not yet verified against a real R2 or S3 bucket**, since no credentials are
  provisioned.
- Antivirus scanning: not implemented (`SKIPPED`).
