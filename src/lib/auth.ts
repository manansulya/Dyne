import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

// Refuse to start without a proper NEXTAUTH_SECRET in production.
// Note: During `next build`, NODE_ENV is "production" but we're not actually
// serving requests — so we skip the throw during build and only enforce at runtime.
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const FALLBACK_DEV_SECRET = "dyne-dev-secret-DO-NOT-USE-IN-PRODUCTION";
const IS_BUILD_TIME = !!process.env.NEXT_PHASE || process.env.NEXT_BUILD === "true";
if (
  !NEXTAUTH_SECRET ||
  NEXTAUTH_SECRET === "dyne-dev-secret-change-in-production" ||
  NEXTAUTH_SECRET === FALLBACK_DEV_SECRET
) {
  if (process.env.NODE_ENV === "production" && !IS_BUILD_TIME) {
    throw new Error(
      "FATAL: NEXTAUTH_SECRET must be set to a random 32+ byte string in production. Generate one with: openssl rand -base64 32"
    );
  }
  if (!IS_BUILD_TIME) {
    console.warn(
      "[auth] WARNING: NEXTAUTH_SECRET not set — using insecure dev fallback. DO NOT use in production."
    );
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/?auth=login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          // Returning null (not throwing) tells NextAuth the credentials are invalid.
          return null;
        }
        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            institution: true,
            semesterName: true,
            onboarded: true,
            username: true,
            bio: true,
            avatarUrl: true,
          },
        });
        // Use a single generic error path for both "no account" and "wrong password"
        // to prevent user-enumeration attacks. Return null, don't throw.
        if (!user) {
          // Run a dummy bcrypt.compare to equalize timing
          await verifyPassword(credentials.password, "$2a$10$dummyhashfortimingequalProtectionxxxxxxxxxxxxxxxxxxxxxx");
          return null;
        }
        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On first sign-in: user is provided. Cache all fields in the JWT
      // so we never hit the DB on subsequent session reads.
      if (user) {
        token.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            name: true,
            email: true,
            institution: true,
            semesterName: true,
            onboarded: true,
            username: true,
            bio: true,
            avatarUrl: true,
          },
        });
        if (dbUser) {
          token.name = dbUser.name ?? undefined;
          token.email = dbUser.email;
          token.institution = dbUser.institution ?? undefined;
          token.semesterName = dbUser.semesterName ?? undefined;
          token.onboarded = dbUser.onboarded;
          token.username = dbUser.username ?? undefined;
          token.bio = dbUser.bio ?? undefined;
          token.avatarUrl = dbUser.avatarUrl ?? undefined;
        }
      }
      // When client calls useSession().update() or updateSession(), refresh
      // the cached fields from the DB.
      if (trigger === "update" && token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            name: true,
            institution: true,
            semesterName: true,
            onboarded: true,
            username: true,
            bio: true,
            avatarUrl: true,
          },
        });
        if (dbUser) {
          token.name = dbUser.name ?? undefined;
          token.institution = dbUser.institution ?? undefined;
          token.semesterName = dbUser.semesterName ?? undefined;
          token.onboarded = dbUser.onboarded;
          token.username = dbUser.username ?? undefined;
          token.bio = dbUser.bio ?? undefined;
          token.avatarUrl = dbUser.avatarUrl ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // No DB lookup — read everything from the JWT (fast).
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.onboarded = token.onboarded as boolean | undefined;
        session.user.institution = (token.institution as string | undefined) ?? null;
        session.user.semesterName = (token.semesterName as string | undefined) ?? null;
        session.user.username = (token.username as string | undefined) ?? null;
        session.user.bio = (token.bio as string | undefined) ?? null;
        session.user.avatarUrl = (token.avatarUrl as string | undefined) ?? null;
      }
      return session;
    },
  },
  secret: NEXTAUTH_SECRET ?? FALLBACK_DEV_SECRET,
};

export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    onboarded?: boolean;
    institution?: string | null;
    semesterName?: string | null;
    username?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  };
};
