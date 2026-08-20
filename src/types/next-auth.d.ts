import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      email: string;
      name?: string | null;
      onboarded?: boolean;
      institution?: string | null;
      semesterName?: string | null;
      username?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    name?: string;
    email?: string;
    institution?: string;
    semesterName?: string;
    onboarded?: boolean;
    username?: string;
    bio?: string;
    avatarUrl?: string;
  }
}
