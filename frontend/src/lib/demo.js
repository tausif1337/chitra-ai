/**
 * Demo account shown on the sign-in screen.
 *
 * The credentials come from build-time environment variables rather than being
 * hard-coded, so they never sit in the repository and can be rotated or
 * switched off from the Vercel dashboard without a code change.
 *
 * Anything in a `VITE_` variable is compiled into the client bundle and is
 * therefore public. That is fine for a deliberately shared demo login, and it
 * is the reason the demo account must stay an ordinary rate-limited user with
 * no staff or superuser rights.
 *
 * Exported as a function rather than a constant so the value is read at call
 * time -- a module-level const would be frozen at import and could not be
 * substituted in tests.
 */

/**
 * @returns {{ email: string, password: string } | null} Null when either
 *   variable is unset, which hides the panel entirely.
 */
export function getDemoAccount() {
  const email = import.meta.env.VITE_DEMO_EMAIL?.trim() ?? "";
  const password = import.meta.env.VITE_DEMO_PASSWORD?.trim() ?? "";
  return email && password ? { email, password } : null;
}
