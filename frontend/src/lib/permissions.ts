export type UserLike = {
  role?: string | null;
} | null | undefined;

const STUDENT_WRITE_ROLES = new Set(["admin", "staff"]);
const EXAM_WRITE_ROLES = new Set(["admin", "grade_manager", "staff"]);
const SCORE_WRITE_ROLES = new Set(["admin", "grade_manager", "staff"]);

function hasRole(user: UserLike, roles: Set<string>): boolean {
  return !!user?.role && roles.has(user.role);
}

export function canWriteStudents(user: UserLike): boolean {
  return hasRole(user, STUDENT_WRITE_ROLES);
}

export function canWriteExams(user: UserLike): boolean {
  return hasRole(user, EXAM_WRITE_ROLES);
}

export function canWriteScores(user: UserLike): boolean {
  return hasRole(user, SCORE_WRITE_ROLES);
}
