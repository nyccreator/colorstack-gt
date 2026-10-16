const GT_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*gatech\.edu$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isGeorgiaTechEmail(value: string): boolean {
  return GT_EMAIL.test(normalizeEmail(value));
}

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

// A personal address is how the club reaches a member after Georgia Tech, so it can't be one.
export function personalEmailError(value: string): string | undefined {
  if (!isEmail(value)) return "Enter a valid email address.";
  if (isGeorgiaTechEmail(value)) return "Use a personal email, not a Georgia Tech one.";
  return undefined;
}

export function isPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return digits.length >= 7 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

const PROFILES = {
  linkedin: {
    link: /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i,
    name: /^[\p{L}\p{N}-]{3,100}$/u,
    base: "https://www.linkedin.com/in/",
    error: "Enter the part of your LinkedIn link after /in/.",
    short: "That LinkedIn name is too short.",
  },
  github: {
    link: /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)(?:[/?#]\S*)?$/i,
    name: /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
    base: "https://github.com/",
    error: "Enter your GitHub username.",
  },
};

export type ProfileSite = keyof typeof PROFILES;

// The field shows the site's address before the name, so a pasted link keeps only the name.
export function profileName(site: ProfileSite, value: string): string {
  const trimmed = value.trim();
  const name = PROFILES[site].link.exec(trimmed)?.[1];
  if (!name) return trimmed.replace(/^@/, "");
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function profileError(site: ProfileSite, value: string): string | undefined {
  const name = profileName(site, value);
  if (!name || PROFILES[site].name.test(name)) return undefined;
  const rules: { error: string; short?: string } = PROFILES[site];
  return rules.short && name.length < 3 ? rules.short : rules.error;
}

export function profileUrl(site: ProfileSite, value: string): string | undefined {
  const name = profileName(site, value);
  return name ? PROFILES[site].base + encodeURIComponent(name) : undefined;
}
