export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof options.body === "string")
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("sportchain:session-expired"));
    const data = await response.json().catch(() => ({
      detail: "The API is unavailable. Check the backend service.",
    }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form values and try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
