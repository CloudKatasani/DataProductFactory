import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/lib/actions/auth";

/**
 * Top bar shown on authenticated pages. The sign-out control is a plain form
 * posting to a server action, so it works without client JS.
 */
export async function AppHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/workspace" className="text-sm font-semibold tracking-tight">
          Data Product Factory
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/workspace" className="hover:text-foreground">
            Workspaces
          </Link>
          <Link href="/review" className="hover:text-foreground">
            Review
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-[var(--muted)]">{user.name}</span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-background"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
