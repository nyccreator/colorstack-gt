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

export function isPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return digits.length >= 7 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function normalizeUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isProfileUrl(value: string): boolean {
  const url = normalizeUrl(value);
  if (!url) return false;
  try {
    return new URL(url).hostname.includes(".");
  } catch {
    return false;
  }
}
