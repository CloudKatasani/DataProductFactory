import { auth } from "@/auth";
import { prisma } from "@/lib/db/client";
import { Role } from "@/lib/artifacts/enums";
import { notAuthorized, roleNotHeld } from "@/lib/governance/errors";

/**
 * Server-side identity and authorization. Every mutation resolves the acting
 * user and their roles here — never from anything the client sent (CLAUDE.md
 * section 4). A hidden button is not a control; this is.
 */

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/** The authenticated user, or null when signed out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.archivedAt) return null;
  return { id: user.id, name: user.name, email: user.email };
}

/** The authenticated user, or a typed NOT_AUTHORIZED error. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw notAuthorized("You must be signed in to do this.");
  }
  return user;
}

/** Roles the user holds in a workspace, resolved live from RoleAssignment. */
export async function rolesInWorkspace(
  userId: string,
  workspaceId: string,
): Promise<Role[]> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId, workspaceId },
    select: { role: true },
  });
  return assignments
    .map((a) => Role.safeParse(a.role))
    .filter((r): r is { success: true; data: Role } => r.success)
    .map((r) => r.data);
}

export async function holdsRole(
  userId: string,
  workspaceId: string,
  role: Role,
): Promise<boolean> {
  return (await rolesInWorkspace(userId, workspaceId)).includes(role);
}

/**
 * Assert the user holds `role` in the workspace, or throw the same typed
 * ROLE_NOT_HELD error the governance layer uses, so the UI has one message shape
 * to render.
 */
export async function requireRole(
  userId: string,
  workspaceId: string,
  workspaceSlug: string,
  role: Role,
): Promise<void> {
  if (!(await holdsRole(userId, workspaceId, role))) {
    throw roleNotHeld(role, workspaceSlug);
  }
}
