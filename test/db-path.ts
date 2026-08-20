import path from "node:path";

/** Absolute path of the SQLite file used by the integration test suite. */
export const TEST_DB_FILE = path.resolve(process.cwd(), "db/test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_FILE}`;
