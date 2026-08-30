export const GRADUATION_YEAR_SPAN = 4;

/** Guards new submissions only. Stored years are never re-checked against it. */
export function graduationYearOptions(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let year = current - GRADUATION_YEAR_SPAN; year <= current + GRADUATION_YEAR_SPAN; year++) {
    years.push(year);
  }
  return years;
}

export function isGraduationYearAllowed(year: number, now: Date = new Date()): boolean {
  const current = now.getFullYear();
  return year >= current - GRADUATION_YEAR_SPAN && year <= current + GRADUATION_YEAR_SPAN;
}
