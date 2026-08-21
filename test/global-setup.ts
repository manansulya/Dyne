import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TEST_DATABASE_URL, TEST_DB_FILE, TEST_STORAGE_ROOT } from "./db-path";

/**
 * Builds the integration test database from the committed migrations — the same
 * `prisma migrate deploy` path production uses, so a broken migration fails the
 * suite instead of being papered over by `db push`.
 */
export default function setup() {
  fs.mkdirSync(path.dirname(TEST_DB_FILE), { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${TEST_DB_FILE}${suffix}`, { force: true });
  }
  fs.rmSync(TEST_STORAGE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_STORAGE_ROOT, { recursive: true });
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
