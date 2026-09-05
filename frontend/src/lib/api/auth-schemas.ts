import { z } from "zod";

export const userSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  email: z.string(),
  role: z.enum(["admin", "user"]),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  email_verified: z.boolean(),
  verification_required: z.boolean(),
  email_verification_enabled: z.boolean(),
  date_joined: z.string(),
});
export const authSessionSchema = z.object({
  access: z.string().min(1),
  user: userSchema,
});
export const messageSchema = z.object({ detail: z.string() });
export const signupResponseSchema = messageSchema.extend({
  verification_required: z.boolean(),
});
export type AuthUser = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
