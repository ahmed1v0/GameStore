export type LoginReason = "session-expired";

export function safeReturnTo(
  value: string | null | undefined,
  fallback = "/products",
) {
  if (!value) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    decoded.startsWith("//") ||
    value.includes("\\") ||
    decoded.includes("\\") ||
    value.startsWith("/login")
  ) {
    return fallback;
  }

  return value;
}

export function loginUrl(returnTo: string, reason?: LoginReason) {
  const params = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  if (reason) params.set("reason", reason);
  return `/login?${params.toString()}`;
}
