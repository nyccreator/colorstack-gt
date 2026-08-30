const GT_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*gatech\.edu$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isGeorgiaTechEmail(value: string): boolean {
  return GT_EMAIL.test(normalizeEmail(value));
}
