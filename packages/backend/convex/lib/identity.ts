const GT_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*gatech\.edu$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isGeorgiaTechEmail(value: string): boolean {
  return GT_EMAIL.test(normalizeEmail(value));
}

export function isPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return digits.length >= 7 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}
