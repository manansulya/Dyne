import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("[register] error", err);
    return NextResponse.json(
      { error: "Something went wrong while creating your account. Please try again." },
      { status: 500 }
    );
  }
}
