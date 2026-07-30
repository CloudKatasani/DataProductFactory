"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";

/**
 * Credentials sign-in. Seeded local users all share one dev password; the hint
 * below is intentional for the offline demo and harmless — there are no real
 * secrets in a freshly seeded local database.
 */
export default function LoginPage() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Data Product Factory</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue="owner@dpf.local"
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-[var(--border)] bg-background px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Seeded users: owner@, consumer@, architect@, steward@, privacy@ … at dpf.local.
        Password for all: <code className="font-mono">dpf-local-dev</code>
      </p>
    </main>
  );
}
