export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const SHOW_MY_STATS = false; // true = show the My Stats links again (customers.lookup is admin-only, so the page only works for admins until that is revisited)
export const SHOW_STAKEHOUSE = false; // true = show The Stakehouse button again

// Generate login URL at runtime so redirect URI reflects the current origin.
// Pass an optional returnPath (e.g. "/admin") to be redirected there after login.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  // Encode origin + optional returnPath so the OAuth callback can redirect back
  const statePayload = returnPath
    ? `${window.location.origin}${returnPath}`
    : redirectUri;
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
