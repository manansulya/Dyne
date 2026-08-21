/**
 * Content-type detection and the upload allowlist.
 *
 * The browser-supplied `Content-Type` and the filename extension are both
 * attacker-controlled, so neither is trusted: the type is sniffed from the
 * bytes and the extension is then derived from the sniffed type. A file whose
 * bytes do not match a type on the allowlist is rejected outright.
 */

export type AttachmentKind =
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "PDF"
  | "DOCUMENT"
  | "SPREADSHEET"
  | "PRESENTATION"
  | "TEXT"
  | "ARCHIVE";

export interface AllowedType {
  contentType: string;
  extension: string;
  kind: AttachmentKind;
  maxBytes: number;
  /** Safe to render in a browser tab (still served with a locked-down CSP). */
  inlineSafe: boolean;
}

const MB = 1024 * 1024;

export const MAX_UPLOAD_BYTES = 100 * MB;

const TYPES: readonly AllowedType[] = [
  { contentType: "image/jpeg", extension: "jpg", kind: "IMAGE", maxBytes: 25 * MB, inlineSafe: true },
  { contentType: "image/png", extension: "png", kind: "IMAGE", maxBytes: 25 * MB, inlineSafe: true },
  { contentType: "image/gif", extension: "gif", kind: "IMAGE", maxBytes: 25 * MB, inlineSafe: true },
  { contentType: "image/webp", extension: "webp", kind: "IMAGE", maxBytes: 25 * MB, inlineSafe: true },
  { contentType: "image/avif", extension: "avif", kind: "IMAGE", maxBytes: 25 * MB, inlineSafe: true },
  { contentType: "video/mp4", extension: "mp4", kind: "VIDEO", maxBytes: 100 * MB, inlineSafe: true },
  { contentType: "video/quicktime", extension: "mov", kind: "VIDEO", maxBytes: 100 * MB, inlineSafe: true },
  { contentType: "video/webm", extension: "webm", kind: "VIDEO", maxBytes: 100 * MB, inlineSafe: true },
  { contentType: "audio/mpeg", extension: "mp3", kind: "AUDIO", maxBytes: 50 * MB, inlineSafe: true },
  { contentType: "audio/wav", extension: "wav", kind: "AUDIO", maxBytes: 50 * MB, inlineSafe: true },
  { contentType: "audio/ogg", extension: "ogg", kind: "AUDIO", maxBytes: 50 * MB, inlineSafe: true },
  { contentType: "audio/flac", extension: "flac", kind: "AUDIO", maxBytes: 50 * MB, inlineSafe: true },
  { contentType: "audio/mp4", extension: "m4a", kind: "AUDIO", maxBytes: 50 * MB, inlineSafe: true },
  // PDFs can carry scripts, so they are never inlined on the app origin.
  { contentType: "application/pdf", extension: "pdf", kind: "PDF", maxBytes: 50 * MB, inlineSafe: false },
  { contentType: "text/plain", extension: "txt", kind: "TEXT", maxBytes: 10 * MB, inlineSafe: false },
  { contentType: "text/csv", extension: "csv", kind: "TEXT", maxBytes: 25 * MB, inlineSafe: false },
  {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    kind: "DOCUMENT",
    maxBytes: 50 * MB,
    inlineSafe: false,
  },
  {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    kind: "SPREADSHEET",
    maxBytes: 50 * MB,
    inlineSafe: false,
  },
  {
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
    kind: "PRESENTATION",
    maxBytes: 50 * MB,
    inlineSafe: false,
  },
  {
    contentType: "application/vnd.oasis.opendocument.text",
    extension: "odt",
    kind: "DOCUMENT",
    maxBytes: 50 * MB,
    inlineSafe: false,
  },
  {
    contentType: "application/vnd.oasis.opendocument.spreadsheet",
    extension: "ods",
    kind: "SPREADSHEET",
    maxBytes: 50 * MB,
    inlineSafe: false,
  },
  { contentType: "application/msword", extension: "doc", kind: "DOCUMENT", maxBytes: 50 * MB, inlineSafe: false },
  { contentType: "application/zip", extension: "zip", kind: "ARCHIVE", maxBytes: 100 * MB, inlineSafe: false },
  { contentType: "application/gzip", extension: "gz", kind: "ARCHIVE", maxBytes: 100 * MB, inlineSafe: false },
  { contentType: "application/x-7z-compressed", extension: "7z", kind: "ARCHIVE", maxBytes: 100 * MB, inlineSafe: false },
  { contentType: "application/x-rar-compressed", extension: "rar", kind: "ARCHIVE", maxBytes: 100 * MB, inlineSafe: false },
];

const BY_CONTENT_TYPE = new Map(TYPES.map((t) => [t.contentType, t]));

export function allowedTypes(): readonly AllowedType[] {
  return TYPES;
}

export function allowedType(contentType: string): AllowedType | null {
  return BY_CONTENT_TYPE.get(contentType) ?? null;
}

/** The `accept` attribute for file pickers — advisory only, never trusted. */
export function acceptAttribute(): string {
  return TYPES.map((t) => t.contentType).join(",");
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Buffer, offset: number, text: string): boolean {
  return buf.slice(offset, offset + text.length).toString("latin1") === text;
}

/** OOXML/ODF containers are ZIPs; the real type is in the archive listing. */
function sniffZipContainer(buf: Buffer): string {
  // ODF stores an uncompressed `mimetype` entry first, at a fixed offset.
  if (ascii(buf, 30, "mimetypeapplication/vnd.oasis.opendocument.text")) {
    return "application/vnd.oasis.opendocument.text";
  }
  if (ascii(buf, 30, "mimetypeapplication/vnd.oasis.opendocument.spreadsheet")) {
    return "application/vnd.oasis.opendocument.spreadsheet";
  }
  // OOXML: look for the part names in the (uncompressed) central directory.
  const window = buf.slice(0, Math.min(buf.length, 64 * 1024)).toString("latin1");
  const tail = buf.slice(Math.max(0, buf.length - 64 * 1024)).toString("latin1");
  const haystack = window + tail;
  if (haystack.includes("word/document.xml")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (haystack.includes("xl/workbook.xml")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (haystack.includes("ppt/presentation.xml")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/zip";
}

function sniffIsoBmff(buf: Buffer): string | null {
  if (!ascii(buf, 4, "ftyp")) return null;
  const brand = buf.slice(8, 12).toString("latin1");
  if (brand.startsWith("qt")) return "video/quicktime";
  if (brand.startsWith("M4A")) return "audio/mp4";
  if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
  return "video/mp4";
}

/**
 * Is this plausibly UTF-8 text with no control characters that would let it be
 * mistaken for another format? Used as the last resort so that .txt/.csv work
 * without accepting arbitrary binary as "text".
 */
function looksLikeText(buf: Buffer): boolean {
  const sample = buf.slice(0, 8192);
  if (sample.length === 0) return false;
  if (sample.toString("utf8").includes("\uFFFD")) return false;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09) return false;
    if (byte > 0x0d && byte < 0x20) return false;
  }
  return true;
}

/**
 * Content types that must never be accepted, even though sniffing would place
 * them in the text family: the browser would execute them if they were ever
 * served inline from the application origin.
 */
function looksExecutable(buf: Buffer): boolean {
  const head = buf.slice(0, 1024).toString("latin1").toLowerCase().trimStart();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.includes("<script") ||
    head.startsWith("<?php") ||
    head.startsWith("#!") ||
    head.startsWith("<svg") ||
    startsWith(buf, [0x4d, 0x5a]) || // Windows PE
    startsWith(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(buf, [0xcf, 0xfa, 0xed, 0xfe]) // Mach-O
  );
}

export interface SniffResult {
  contentType: string;
  type: AllowedType;
}

export type SniffFailure =
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "executable" }
  | { ok: false; reason: "unsupported"; detected: string };

export type SniffOutcome = ({ ok: true } & SniffResult) | SniffFailure;

/**
 * Detect the content type from the leading bytes. `claimedName` only chooses
 * between text/plain and text/csv once the bytes have already been proven to be
 * plain text.
 */
export function sniffContentType(buf: Buffer, claimedName = ""): SniffOutcome {
  if (buf.length === 0) return { ok: false, reason: "empty" };
  if (looksExecutable(buf)) return { ok: false, reason: "executable" };

  let detected: string | null = null;

  if (startsWith(buf, [0xff, 0xd8, 0xff])) detected = "image/jpeg";
  else if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) detected = "image/png";
  else if (ascii(buf, 0, "GIF87a") || ascii(buf, 0, "GIF89a")) detected = "image/gif";
  else if (ascii(buf, 0, "RIFF") && ascii(buf, 8, "WEBP")) detected = "image/webp";
  else if (ascii(buf, 0, "RIFF") && ascii(buf, 8, "WAVE")) detected = "audio/wav";
  else if (ascii(buf, 0, "%PDF-")) detected = "application/pdf";
  else if (ascii(buf, 0, "OggS")) detected = "audio/ogg";
  else if (ascii(buf, 0, "fLaC")) detected = "audio/flac";
  else if (ascii(buf, 0, "ID3") || startsWith(buf, [0xff, 0xfb]) || startsWith(buf, [0xff, 0xf3]))
    detected = "audio/mpeg";
  else if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) detected = "video/webm";
  else if (startsWith(buf, [0x1f, 0x8b])) detected = "application/gzip";
  else if (ascii(buf, 0, "7z\xbc\xaf\x27\x1c")) detected = "application/x-7z-compressed";
  else if (ascii(buf, 0, "Rar!")) detected = "application/x-rar-compressed";
  else if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) detected = "application/msword";
  else if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) detected = sniffZipContainer(buf);
  else detected = sniffIsoBmff(buf);

  if (!detected && looksLikeText(buf)) {
    detected = claimedName.toLowerCase().endsWith(".csv") ? "text/csv" : "text/plain";
  }

  if (!detected) return { ok: false, reason: "unsupported", detected: "unknown" };

  const type = allowedType(detected);
  if (!type) return { ok: false, reason: "unsupported", detected };
  return { ok: true, contentType: detected, type };
}

/**
 * Strip everything that could make a stored name dangerous: directory
 * components, control characters, leading dots, and the caller's extension
 * (which is replaced with the one implied by the sniffed type).
 */
export function sanitizeFilename(raw: string, extension: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const withoutExtension = base.replace(/\.[A-Za-z0-9]{1,12}$/, "");
  const cleaned = withoutExtension
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    .replace(/^[.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${cleaned || "file"}.${extension}`;
}
