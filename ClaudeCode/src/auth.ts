import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Auth.js (v5) credentials provider over the locally-seeded users. Sessions are
 * JWT — no adapter — so the whole thing works offline with SQLite and never
 * needs a network round-trip (Non-Negotiable 6).
 *
 * The session carries only the user id. Roles are deliberately NOT baked into
 * the token: authorization is always resolved server-side from RoleAssignment at
 * the moment of the action, so a role revoked mid-session takes effect at once
 * and a client-supplied role is never trusted (CLAUDE.md section 4).
 */
const Credential = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = Credential.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || user.archivedAt) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
