import { z } from "zod";
import { apiRequest } from "./client";
import {
  messageSchema,
  signupResponseSchema,
  userSchema,
} from "./auth-schemas";
import { authPost, rawRequest } from "./transport";

export {
  authSessionSchema,
  type AuthSession,
  type AuthUser,
} from "./auth-schemas";

export const signup = (body: Record<string, string>) =>
  authPost("/auth/signup", signupResponseSchema, body);

export const getAuthConfiguration = () =>
  rawRequest(
    "/auth/csrf",
    z.object({ email_verification_enabled: z.boolean() }),
  );

export const verifyEmail = (token: string) =>
  authPost("/auth/verify-email", messageSchema, { token });

export const requestEmail = (email: string, verification = false) =>
  authPost(
    verification ? "/auth/resend-verification" : "/auth/forgot-password",
    messageSchema,
    { email },
  );

export const getMe = (access: string, signal?: AbortSignal) =>
  apiRequest("/auth/me", {
    schema: userSchema,
    accessToken: access,
    init: { signal },
  });

const usersPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(userSchema),
});

export function getUsers(
  access: string,
  page: number,
  search: string,
  signal?: AbortSignal,
) {
  return apiRequest(
    `/admin/users?${new URLSearchParams({ page: String(page), search })}`,
    {
      schema: usersPageSchema,
      accessToken: access,
      init: { signal },
    },
  );
}

export function inviteUser(
  access: string,
  invitation: {
    username: string;
    email: string;
    role: "admin" | "user";
  },
) {
  return apiRequest("/admin/users/invitations", {
    schema: userSchema,
    accessToken: access,
    init: {
      method: "POST",
      body: JSON.stringify(invitation),
    },
  });
}

export function updateUser(
  access: string,
  id: number,
  changes: { role?: "admin" | "user"; is_active?: boolean },
) {
  return apiRequest(`/admin/users/${id}`, {
    schema: userSchema,
    accessToken: access,
    init: { method: "PATCH", body: JSON.stringify(changes) },
  });
}
