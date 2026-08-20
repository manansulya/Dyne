import path from "node:path";

/** Absolute path of the SQLite file used by the integration test suite. */
export const TEST_DB_FILE = path.resolve(process.cwd(), "db/test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_FILE}`;

/** Root the local storage driver writes to during the test suite. */
export const TEST_STORAGE_ROOT = path.resolve(process.cwd(), "db/test-storage");
