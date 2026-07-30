import type { DefaultSession } from "next-auth";

/**
 * The session user carries the DB user id so server code can resolve roles from
 * RoleAssignment without a second lookup by email.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
