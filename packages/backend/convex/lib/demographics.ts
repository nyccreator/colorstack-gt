export const PREFER_NOT = "prefer_not_to_answer";

export function toggleRace<T extends string>(races: readonly T[], value: T): T[] {
  if (value === PREFER_NOT) return races.includes(value) ? [] : [value];
  const rest = races.filter((race) => race !== PREFER_NOT);
  return rest.includes(value) ? rest.filter((race) => race !== value) : [...rest, value];
}

export function soleRace<T extends string>(races: readonly T[]): T[] {
  return races.includes(PREFER_NOT as T) ? [PREFER_NOT as T] : [...new Set(races)];
}
