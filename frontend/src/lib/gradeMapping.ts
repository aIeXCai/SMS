// Grade level name → cohort display string
// Used to convert user.managed_grade ("初一") to exam/student filter values ("初中2025级")
// Update the cohort year when the school year changes
export const GRADE_TO_COHORT: Record<string, string> = {
  '初一': '初中2025级',
  '初二': '初中2024级',
  '初三': '初中2023级',
  '高一': '高中2025级',
  '高二': '高中2024级',
  '高三': '高中2023级',
};

export const COHORT_TO_GRADE: Record<string, string> = {};
for (const [grade, cohort] of Object.entries(GRADE_TO_COHORT)) {
  COHORT_TO_GRADE[cohort] = grade;
}

/**
 * Convert a grade level name (e.g. "初一") to its cohort string (e.g. "初中2025级")
 */
export function gradeToCohort(grade: string | undefined): string | null {
  if (!grade) return null;
  return GRADE_TO_COHORT[grade] ?? null;
}
