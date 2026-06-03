import "dotenv/config";

import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    SERVER_PORT: z.coerce.number().int().min(1).max(65535),
    CLIENT_ORIGIN: z.string().url(),
    REDIS_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(16)
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    const obviousPlaceholderSecrets = new Set([
      "replace-with-local-dev-secret",
      "change-me",
      "changeme",
      "secret",
      "password",
      "dev-secret"
    ]);

    if (obviousPlaceholderSecrets.has(env.SESSION_SECRET.toLowerCase())) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message: "Production SESSION_SECRET must not use an obvious placeholder value."
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }

  return parsed.data;
}