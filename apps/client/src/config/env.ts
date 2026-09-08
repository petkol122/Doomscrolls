export interface ClientEnv {
  readonly apiUrl: URL | undefined;
  readonly wsUrl: URL | undefined;
  readonly isDevBuild: boolean;
}

function readOptionalUrl(name: "VITE_API_URL" | "VITE_WS_URL"): URL | undefined {
  const rawValue = import.meta.env?.[name];

  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return undefined;
  }

  try {
    return new URL(rawValue);
  } catch {
    console.warn(`${name} is configured but is not a valid URL. Ignoring value.`);
    return undefined;
  }
}

export const clientEnv: ClientEnv = {
  apiUrl: readOptionalUrl("VITE_API_URL"),
  wsUrl: readOptionalUrl("VITE_WS_URL"),
  // Gates dev-only UI (e.g. the world session Debug Panel menu item) out of
  // production builds. `import.meta.env.DEV` is Vite's own build-mode flag,
  // not a custom convention.
  isDevBuild: import.meta.env.DEV === true
};