// Client-side fetch helper for our /api/auth routes. Normalizes every failure
// mode into a single shape so form handlers don't each re-implement try/catch,
// JSON parsing, and network-error messages.
export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Network error. Check your connection and try again.",
    };
  }

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    // Non-JSON response (e.g. an error page) — leave data null.
  }

  const error = res.ok
    ? null
    : (data as { error?: string } | null)?.error ??
      `Something went wrong (${res.status}). Please try again.`;

  return { ok: res.ok, status: res.status, data, error };
}
