const PREFER_NOT = "prefer_not_to_answer";

/** "Prefer not to answer" stands alone among race and ethnicity answers, as saveDemographics enforces. */
export function toggleRace<T extends string>(races: readonly T[], value: T): T[] {
  if (value === PREFER_NOT) return races.includes(value) ? [] : [value];
  const rest = races.filter((race) => race !== PREFER_NOT);
  return rest.includes(value) ? rest.filter((race) => race !== value) : [...rest, value];
}
