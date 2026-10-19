export const GRADUATION_YEAR_SPAN = 4;

export function graduationYearOptions(now: Date = new Date()): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let year = current - GRADUATION_YEAR_SPAN; year <= current + GRADUATION_YEAR_SPAN; year++) {
    years.push(year);
  }
  return years;
}

export const isGraduationYearAllowed = (year: number, now: Date = new Date()): boolean =>
  graduationYearOptions(now).includes(year);
