import { z, type ZodType } from "zod";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const fields = body as Record<string, unknown>;
    if (typeof fields.detail === "string") return fields.detail;
    const messages = Object.entries(fields).flatMap(([field, value]) => {
      const text = Array.isArray(value)
        ? value.join(" ")
        : typeof value === "string"
          ? value
          : "";
      return text
        ? [
            `${field === "non_field_errors" ? "" : `${field.replaceAll("_", " ")}: `}${text}`,
          ]
        : [];
    });
    if (messages.length) return messages.join(" ");
  }
  if (status === 429)
    return "Too many attempts. Please wait before trying again.";
  if (status >= 500)
    return "The service is unavailable. Please try again shortly.";
  return `Request failed with status ${status}.`;
}

export async function rawRequest<T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      errorMessage(body, response.status),
      response.status,
      body,
    );
  return schema.parse(body);
}

export async function authPost<T>(
  path: string,
  schema: ZodType<T>,
  body?: unknown,
  access?: string,
) {
  const csrf = await rawRequest(
    "/auth/csrf",
    z.object({ csrfToken: z.string() }),
  );
  const headers = new Headers({ "X-CSRFToken": csrf.csrfToken });
  if (access) headers.set("Authorization", `Bearer ${access}`);
  return rawRequest(path, schema, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}
