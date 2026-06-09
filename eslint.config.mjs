// Doomscrolls root ESLint flat config (Task 266).
//
// Goal: a real, lightweight TypeScript lint gate that catches obvious
// mistakes and unused code, without forcing a stylistic rewrite of the
// existing codebase.
//
// This config is the single source of truth for linting across:
//   - apps/client
//   - apps/server
//   - packages/shared
//   - packages/content
//   - packages/localization
//
// Per-package `lint` scripts invoke `eslint` with their own source area
// and pick this root config up automatically.

import tseslint from "typescript-eslint";

const SOURCE_GLOBS = {
  client: ["apps/client/src/**/*.ts", "apps/client/vite.config.ts"],
  server: [
    "apps/server/src/**/*.ts",
    "apps/server/scripts/**/*.ts",
    "packages/shared/src/**/*.ts",
    "packages/content/src/**/*.ts",
    "packages/localization/src/**/*.ts",
  ],
  shared: ["packages/shared/src/**/*.ts"],
  content: ["packages/content/src/**/*.ts"],
  localization: ["packages/localization/src/**/*.ts"],
};

const baseIgnores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.pnpm-store/**",
  "**/coverage/**",
];

const commonRules = {
  // Practical TS quality rules.
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
      destructuredArrayIgnorePattern: "^_",
    },
  ],
  "@typescript-eslint/no-unused-imports": "off", // covered by no-unused-vars above
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-non-null-assertion": "warn",

  // Allow the patterns the codebase already uses; do not chase style churn.
  "no-console": "off",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-prototype-builtins": "off",
  "no-useless-escape": "warn",
};

export default tseslint.config(
  {
    ignores: baseIgnores,
  },

  // Client (browser / Phaser / Vite)
  {
    files: SOURCE_GLOBS.client,
    languageOptions: {
      parserOptions: {
        project: ["./apps/client/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: commonRules,
  },

  // Server (Node, Fastify, Colyseus, Prisma) and everything it imports.
  {
    files: SOURCE_GLOBS.server,
    languageOptions: {
      parserOptions: {
        project: ["./apps/server/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...commonRules,
      // Prisma generates `any` in some client surfaces; keep that local.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Shared package (used by both client and server)
  {
    files: SOURCE_GLOBS.shared,
    languageOptions: {
      parserOptions: {
        project: ["./packages/shared/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: commonRules,
  },

  // Content package
  {
    files: SOURCE_GLOBS.content,
    languageOptions: {
      parserOptions: {
        project: ["./packages/content/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: commonRules,
  },

  // Localization package
  {
    files: SOURCE_GLOBS.localization,
    languageOptions: {
      parserOptions: {
        project: ["./packages/localization/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: commonRules,
  },

  // Non-type-checked base recommended rules for everything else (scripts, configs)
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommended],
  },
);
