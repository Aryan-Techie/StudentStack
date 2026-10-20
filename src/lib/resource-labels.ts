import type { Resource } from "@/lib/resources";

// Human-readable labels for resource enums, shared by /r/[slug] and
// /compare/[set].
export const VERIFICATION_LABELS: Record<string, string> = {
  none: "No verification required",
  edu_email: ".edu university email",
  github_student_pack: "GitHub Student Developer Pack",
  student_id: "Student ID upload",
};

export const DURATION_LABELS: Record<string, string> = {
  one_time: "One-time perk",
  one_year: "1 year access",
  while_student: "Valid while enrolled",
  lifetime: "Lifetime access",
};

export const COST_LABELS: Record<Resource["costType"], string> = {
  free: "Free",
  discount: "Discount",
  credits: "Credits",
  trial: "Free trial",
  stipend: "Stipend",
  scholarship: "Scholarship",
};
