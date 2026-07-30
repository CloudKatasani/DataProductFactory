"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/**
 * Credentials sign-in as a server action, for use with React's useActionState.
 * Returns a human-readable error string on failure rather than throwing, so the
 * login form can render it.
 */
export async function authenticate(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("redirectTo") as string) || "/workspace",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === "CredentialsSignin"
        ? "Wrong email or password."
        : "Could not sign you in.";
    }
    // signIn throws a redirect on success — never swallow it.
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
