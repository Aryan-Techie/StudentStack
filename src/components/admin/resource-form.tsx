import type { Category, Resource } from "@/lib/resources";
import { RESOURCE_KIND_VALUES } from "@/db/schema";
import { ELIGIBILITY_LEVELS, toDateInputValue } from "@/lib/admin/opportunity-fields";

const COST_TYPES = ["free", "discount", "stipend", "scholarship", "credits", "trial"] as const;
const STATUS_OPTIONS = ["active", "expired", "broken"] as const;
const VERIFICATION_OPTIONS = [
  ["none", "No verification"],
  ["edu_email", ".edu email"],
  ["github_student_pack", "GitHub Student Pack"],
  ["student_id", "Student ID upload"],
] as const;
const DURATION_OPTIONS = [
  ["one_time", "One-time"],
  ["one_year", "1 year"],
  ["while_student", "While student"],
  ["lifetime", "Lifetime"],
] as const;

export function ResourceForm({
  categories,
  resource,
  defaults,
  candidateId,
  action,
}: {
  categories: Category[];
  resource?: Resource;
  defaults?: {
    name?: string;
    tagline?: string | null;
    description?: string;
    url?: string | null;
    categoryId?: number;
    costType?: string;
    region?: "IN" | "Global";
    tags?: string[];
    kind?: Resource["kind"];
    deadline?: number | null;
    opensAt?: number | null;
    amount?: string | null;
    provider?: string | null;
  };
  candidateId?: number;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      {candidateId && <input type="hidden" name="candidateId" value={candidateId} />}
      <label className="flex flex-col gap-1 text-sm">
        Name *
        <input name="name" defaultValue={resource?.name ?? defaults?.name} required className="border-line rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tagline
        <input name="tagline" defaultValue={resource?.tagline ?? defaults?.tagline ?? ""} className="border-line rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description *
        <textarea
          name="description"
          defaultValue={resource?.description ?? defaults?.description}
          required
          rows={4}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        URL *
        <input
          name="url"
          type="url"
          defaultValue={resource?.url ?? defaults?.url ?? ""}
          required={!resource}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category *
        <select name="categoryId" defaultValue={resource?.categoryId ?? defaults?.categoryId} required className="border-line rounded border px-3 py-2">
          {categories.map((c) => (
            <option key={c.slug} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Cost type *
        <select name="costType" defaultValue={resource?.costType ?? defaults?.costType} required className="border-line rounded border px-3 py-2">
          {COST_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Kind
        <select name="kind" defaultValue={resource?.kind ?? defaults?.kind ?? "perk"} className="border-line rounded border px-3 py-2">
          {RESOURCE_KIND_VALUES.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Region
        <select name="region" defaultValue={resource?.region ?? defaults?.region ?? "Global"} className="border-line rounded border px-3 py-2">
          <option value="Global">Global</option>
          <option value="IN">India</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Verification needed
        <select
          name="verificationNeeded"
          defaultValue={resource?.verificationNeeded ?? ""}
          className="border-line rounded border px-3 py-2"
        >
          <option value="">— Not reviewed —</option>
          {VERIFICATION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Credit card required
        <select
          name="creditCardRequired"
          defaultValue={
            resource?.creditCardRequired === true
              ? "true"
              : resource?.creditCardRequired === false
                ? "false"
                : ""
          }
          className="border-line rounded border px-3 py-2"
        >
          <option value="">— Not reviewed —</option>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Duration
        <select
          name="duration"
          defaultValue={resource?.duration ?? ""}
          className="border-line rounded border px-3 py-2"
        >
          <option value="">— Not reviewed —</option>
          {DURATION_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tags (comma-separated)
        <input name="tags" defaultValue={resource?.tags.join(", ") ?? defaults?.tags?.join(", ")} className="border-line rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Opens at
        <input
          name="opensAt"
          type="date"
          defaultValue={toDateInputValue(resource?.opensAt ?? defaults?.opensAt)}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Deadline
        <input
          name="deadline"
          type="date"
          defaultValue={toDateInputValue(resource?.deadline ?? defaults?.deadline)}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Recurrence
        <input
          name="recurrence"
          placeholder="annual, opens Feb"
          defaultValue={resource?.recurrence ?? ""}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input
          name="amount"
          placeholder="₹31,000/month"
          defaultValue={resource?.amount ?? defaults?.amount ?? ""}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Provider
        <input
          name="provider"
          placeholder="Google, AICTE"
          defaultValue={resource?.provider ?? defaults?.provider ?? ""}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      <fieldset className="border-line flex flex-col gap-3 rounded border px-3 py-3 text-sm">
        <legend className="px-1">Eligibility (leave blank for open)</legend>
        <div className="flex flex-wrap gap-3">
          {ELIGIBILITY_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="eligibilityLevels"
                value={level}
                defaultChecked={resource?.eligibility?.levels?.includes(level)}
              />
              {level}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          Countries (ISO codes, comma-separated)
          <input
            name="eligibilityCountries"
            placeholder="IN"
            defaultValue={resource?.eligibility?.countries?.join(", ") ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          States (comma-separated)
          <input
            name="eligibilityStates"
            defaultValue={resource?.eligibility?.states?.join(", ") ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Fields (comma-separated)
          <input
            name="eligibilityFields"
            placeholder="CS, ECE"
            defaultValue={resource?.eligibility?.fields?.join(", ") ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Minimum year of study
          <input
            name="eligibilityMinYear"
            type="number"
            min={1}
            defaultValue={resource?.eligibility?.minYear ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Maximum age
          <input
            name="eligibilityMaxAge"
            type="number"
            min={1}
            defaultValue={resource?.eligibility?.maxAge ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Gender
          <input
            name="eligibilityGender"
            defaultValue={resource?.eligibility?.gender ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          Family income cap (INR/year)
          <input
            name="eligibilityIncomeCapInr"
            type="number"
            min={1}
            defaultValue={resource?.eligibility?.incomeCapInr ?? ""}
            className="border-line rounded border px-3 py-2"
          />
        </label>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Contributor credit
        <input
          name="contributorCredit"
          maxLength={40}
          defaultValue={resource?.contributorCredit ?? ""}
          className="border-line rounded border px-3 py-2"
        />
      </label>
      {resource && (
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={resource.status} className="border-line rounded border px-3 py-2">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="bg-orange rounded-md px-4 py-2 font-medium">
        {resource ? "Save changes" : "Create resource"}
      </button>
    </form>
  );
}
