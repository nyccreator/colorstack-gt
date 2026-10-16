// The browser asks the server who is signed in once, not on every page change; signing in or out asks again.
let cached: Promise<string | undefined> | null = null;
let seeded = false;

export function sessionToken(load: () => Promise<string | undefined>) {
  if (typeof window === "undefined") return load();
  cached ??= load().catch((failure: unknown) => {
    cached = null;
    throw failure;
  });
  return cached;
}

// The page arrives with the server's answer, which the browser keeps as its first and only seed.
export function knowSession(token: string | undefined) {
  if (typeof window === "undefined" || seeded) return;
  seeded = true;
  cached ??= Promise.resolve(token);
}

export function forgetSession() {
  cached = null;
}
