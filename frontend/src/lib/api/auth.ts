import { z } from "zod";

import { apiRequest } from "./client";

export const authSessionSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export function login(username: string, password: string): Promise<AuthSession> {
  return apiRequest("/auth/login", {
    schema: authSessionSchema,
    init: {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  });
}
