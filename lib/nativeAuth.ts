import "server-only";
import { decodeJwt } from "jose";
import type { AuthClaims } from "./session";

// Server-side client for Microsoft Entra External ID **native authentication**.
// We call Entra's HTTP API directly (the API has no CORS, so it MUST run on the
// server) and drive the continuation-token state machine for sign-up, sign-in,
// and self-service password reset. Native auth is a PUBLIC client flow — only a
// client_id is sent, never a secret.

const SUBDOMAIN = process.env.ENTRA_SUBDOMAIN;
const TENANT = process.env.ENTRA_TENANT;
const CLIENT_ID = process.env.ENTRA_CLIENT_ID;
// `profile` yields name/given_name/family_name, `email` yields the email claim.
// They require consent — fine now that admin consent is granted for the app. If
// AADSTS65001 returns, add `profile`+`email` (Microsoft Graph, delegated) in API
// permissions and grant admin consent again.
const SCOPE = "openid offline_access profile email";
const REQUEST_TIMEOUT_MS = 15000;

export function isNativeAuthConfigured(): boolean {
  return Boolean(SUBDOMAIN && TENANT && CLIENT_ID);
}

// Tolerate common paste mistakes in the env values: a leading "https://", a
// full ".ciamlogin.com" host, a trailing "/v2.0", or extra slashes. We only
// want the bare "<subdomain>" and "<tenant-id-or-domain>".
function strip(value: string | undefined): string {
  return (value ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

// e.g. https://contoso.ciamlogin.com/<tenant-id-or-domain>
function authority(): string {
  const sub = strip(SUBDOMAIN).replace(/\.ciamlogin\.com.*$/i, "");
  const tenant = strip(TENANT)
    .replace(/^[^/]*\.ciamlogin\.com\//i, "") // drop a pasted "<sub>.ciamlogin.com/" prefix
    .replace(/\/v2\.0$/i, ""); // drop a pasted issuer "/v2.0" suffix
  return `https://${sub}.ciamlogin.com/${tenant}`;
}

// Shape of every native-auth JSON response (known fields typed, rest indexed).
type NaJson = {
  error?: string;
  error_description?: string;
  suberror?: string;
  continuation_token?: string;
  challenge_type?: string;
  code_length?: number;
  challenge_target_label?: string;
  interval?: number;
  status?: string;
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  [key: string]: unknown;
};

export class NativeAuthError extends Error {
  code: string;
  suberror?: string;
  constructor(message: string, code: string, suberror?: string) {
    super(message);
    this.name = "NativeAuthError";
    this.code = code;
    this.suberror = suberror;
  }
}

async function postForm(
  path: string,
  params: Record<string, string | undefined>,
): Promise<NaJson> {
  const body = new URLSearchParams();
  body.set("client_id", CLIENT_ID as string);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) body.set(k, v);
  }
  let res: Response;
  try {
    res = await fetch(`${authority()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // DNS/connection failure or timeout — never let a raw fetch error 500.
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    console.error(`[nativeAuth] ${path} -> network failure:`, err);
    throw new NativeAuthError(
      timedOut
        ? "The sign-in service timed out. Please try again."
        : "Couldn't reach the sign-in service. Check your connection and try again.",
      timedOut ? "timeout" : "network_error",
    );
  }

  let json: NaJson = {};
  try {
    json = (await res.json()) as NaJson;
  } catch {
    // Non-JSON body (e.g. an HTML error page); handled by the !res.ok check below.
  }

  if (json.error) {
    // Log the real Entra error for each step (no tokens) so failures are debuggable.
    console.error(
      `[nativeAuth] ${path} -> ${res.status} ${json.error}` +
        `${json.suberror ? "/" + json.suberror : ""}: ${json.error_description ?? ""}`,
    );
  } else if (!res.ok) {
    console.error(`[nativeAuth] ${path} -> ${res.status} with no JSON error body`);
    throw new NativeAuthError(
      "The sign-in service returned an unexpected response. Please try again.",
      `http_${res.status}`,
    );
  }

  return json;
}

// Route handlers map these to 503 (service unavailable) rather than 400.
export function isServiceError(err: NativeAuthError): boolean {
  return (
    err.code === "network_error" ||
    err.code === "timeout" ||
    err.code.startsWith("http_")
  );
}

// Turn an error JSON into a user-friendly NativeAuthError. We default to Entra's
// own error_description (so real failures are visible) and only override it for
// a few cases where a friendlier message is clearly correct.
function fail(json: NaJson, fallback: string): NativeAuthError {
  const code = json.error ?? "unknown_error";
  const sub = json.suberror;
  const desc = json.error_description ?? "";
  let msg = desc || fallback;

  // AADSTS50034 = user doesn't exist in the directory (no account for that email).
  const userNotFound =
    code === "user_not_found" ||
    sub === "user_not_found" ||
    desc.includes("AADSTS50034");

  if (sub === "invalid_oob_value" || code === "invalid_oob_value") {
    msg = "That code isn't correct. Please check it and try again.";
  } else if (sub === "expired_token" || code === "expired_token") {
    msg = "That code has expired. Request a new one.";
  } else if (code === "user_already_exists") {
    msg = "An account with this email already exists. Try signing in instead.";
  } else if (userNotFound) {
    msg = "We couldn't find an account with that email. Check it, or create an account.";
  } else if (sub && sub.startsWith("password_")) {
    msg = "That password doesn't meet the requirements (at least 8 characters).";
  } else if (sub === "attribute_validation_failed" || code === "attribute_validation_failed") {
    msg = "Some of your details weren't accepted. Please review and try again.";
  }
  return new NativeAuthError(msg, code, sub);
}

function requireToken(json: NaJson, fallback: string): string {
  if (json.error || !json.continuation_token) throw fail(json, fallback);
  return json.continuation_token;
}

function guardRedirect(json: NaJson) {
  if (json.challenge_type === "redirect") {
    throw new NativeAuthError(
      "This account must sign in on the web (native auth unavailable).",
      "redirect",
    );
  }
}

// Decode the ID token (received server-to-server over HTTPS) into claims.
function tokensToUser(json: NaJson): AuthClaims {
  if (json.error || !json.id_token) throw fail(json, "Could not complete sign-in.");
  const claims = decodeJwt(json.id_token) as Record<string, unknown>;
  return {
    sub: (claims.sub as string) ?? (claims.oid as string) ?? "",
    email:
      (claims.email as string) ??
      (claims.preferred_username as string) ??
      null,
    name: (claims.name as string) ?? null,
  };
}

// ---- Sign-up: start -> challenge(OTP email) -> continue(oob) -> token ----

export async function signupStart(
  email: string,
  password: string,
  attributes?: Record<string, string>,
): Promise<string> {
  const json = await postForm("/signup/v1.0/start", {
    username: email,
    password,
    challenge_type: "oob password redirect",
    attributes: attributes ? JSON.stringify(attributes) : undefined,
  });
  return requireToken(json, "Could not start sign-up.");
}

export type Challenge = {
  continuationToken: string;
  codeLength: number;
  target: string | null;
};

export async function signupChallenge(
  continuationToken: string,
): Promise<Challenge> {
  const json = await postForm("/signup/v1.0/challenge", {
    continuation_token: continuationToken,
    challenge_type: "oob password redirect",
  });
  guardRedirect(json);
  return {
    continuationToken: requireToken(json, "Could not send the verification code."),
    codeLength: json.code_length ?? 8,
    target: json.challenge_target_label ?? null,
  };
}

// These return the raw response because the caller drives the follow-up state
// machine (oob -> maybe password -> maybe attributes -> success).
export function signupContinueOob(continuationToken: string, oob: string) {
  return postForm("/signup/v1.0/continue", {
    continuation_token: continuationToken,
    grant_type: "oob",
    oob,
  });
}

export function signupContinuePassword(continuationToken: string, password: string) {
  return postForm("/signup/v1.0/continue", {
    continuation_token: continuationToken,
    grant_type: "password",
    password,
  });
}

export function signupContinueAttributes(
  continuationToken: string,
  attributes: Record<string, string>,
) {
  return postForm("/signup/v1.0/continue", {
    continuation_token: continuationToken,
    grant_type: "attributes",
    attributes: JSON.stringify(attributes),
  });
}

// Exchange a completed-flow continuation token for tokens (sign-up / SSPR).
export async function exchangeContinuationToken(
  continuationToken: string,
): Promise<AuthClaims> {
  const json = await postForm("/oauth2/v2.0/token", {
    continuation_token: continuationToken,
    grant_type: "continuation_token",
    scope: SCOPE,
  });
  return tokensToUser(json);
}

// ---- Sign-in: initiate -> challenge -> token(password) ----

export async function signin(
  email: string,
  password: string,
): Promise<AuthClaims> {
  const start = await postForm("/oauth2/v2.0/initiate", {
    username: email,
    challenge_type: "password redirect",
  });
  const ct0 = requireToken(start, "Could not start sign-in.");

  const challenge = await postForm("/oauth2/v2.0/challenge", {
    continuation_token: ct0,
    challenge_type: "password redirect",
  });
  guardRedirect(challenge);
  const ct1 = requireToken(challenge, "Could not start sign-in.");

  const token = await postForm("/oauth2/v2.0/token", {
    continuation_token: ct1,
    grant_type: "password",
    password,
    scope: SCOPE,
  });
  if (token.suberror === "mfa_required") {
    throw new NativeAuthError(
      "This account requires multi-factor authentication (not supported yet).",
      "mfa_required",
      "mfa_required",
    );
  }
  if (token.error || !token.id_token) {
    // User exists (we passed the challenge) but the password was wrong, etc.
    throw new NativeAuthError(
      "Invalid email or password.",
      token.error ?? "invalid_grant",
      token.suberror,
    );
  }
  return tokensToUser(token);
}

// ---- Password reset: start -> challenge -> continue(oob) -> submit(new) -> poll ----

export async function resetStart(email: string): Promise<Challenge> {
  const start = await postForm("/resetpassword/v1.0/start", {
    username: email,
    challenge_type: "oob redirect",
  });
  const ct = requireToken(start, "Could not start password reset.");

  const challenge = await postForm("/resetpassword/v1.0/challenge", {
    continuation_token: ct,
    challenge_type: "oob redirect",
  });
  guardRedirect(challenge);
  return {
    continuationToken: requireToken(challenge, "Could not send the reset code."),
    codeLength: challenge.code_length ?? 8,
    target: challenge.challenge_target_label ?? null,
  };
}

export async function resetSubmitOtp(
  continuationToken: string,
  oob: string,
): Promise<string> {
  const json = await postForm("/resetpassword/v1.0/continue", {
    continuation_token: continuationToken,
    grant_type: "oob",
    oob,
  });
  return requireToken(json, "That code isn't correct.");
}

// Submit the new password, then poll until the reset is applied. Returns a
// continuation token that can be exchanged for tokens (auto sign-in).
export async function resetSubmitNewPassword(
  continuationToken: string,
  newPassword: string,
): Promise<string> {
  // New password goes to /submit (NOT /continue — that's the OTP endpoint and
  // would demand `oob`, i.e. AADSTS900144).
  const submit = await postForm("/resetpassword/v1.0/submit", {
    continuation_token: continuationToken,
    new_password: newPassword,
  });
  let ct = requireToken(submit, "Could not set the new password.");

  for (let i = 0; i < 10; i++) {
    const poll = await postForm("/resetpassword/v1.0/poll_completion", {
      continuation_token: ct,
    });
    if (poll.error) throw fail(poll, "Password reset failed.");
    if (poll.continuation_token) ct = poll.continuation_token;
    if (poll.status === "succeeded") return ct;
    if (poll.status === "failed") {
      throw new NativeAuthError("Password reset failed.", "reset_failed");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return ct;
}
