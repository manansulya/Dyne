import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Recreates the dedicated E2E database from the committed migrations. */
export default function globalSetup() {
  const file = path.resolve(process.cwd(), "db/e2e.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${file}${suffix}`, { force: true });
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${file}` },
    stdio: "inherit",
  });
}
