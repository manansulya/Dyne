import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
