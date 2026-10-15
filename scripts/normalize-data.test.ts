// Unit tests for the heuristic field derivation in normalize-data.ts
// (issue #73): verificationNeeded / creditCardRequired / duration are
// inferred from offer tagline, description, and extra_info notes.
import { describe, expect, it } from "vitest";
import {
  deriveCreditCardRequired,
  deriveDuration,
  deriveVerificationNeeded,
  normalizeRawOffers,
  type RawOffer,
} from "./normalize-data";

const baseOffer: RawOffer = {
  id: 1,
  name: "Sample Tool",
  offer: "",
  description: "",
  claim_url: null,
  location: null,
  tag2: "Free",
  category_main: "Development Tools",
  category_sub: "IDEs",
  slug: "sample-tool",
  extra_info: null,
  tags: [],
};

function offer(overrides: Partial<RawOffer>): RawOffer {
  return { ...baseOffer, ...overrides };
}

describe("deriveVerificationNeeded", () => {
  it("maps GitHub Student mentions to github_student_pack", () => {
    expect(
      deriveVerificationNeeded("Requires GitHub Student Developer Pack"),
    ).toBe("github_student_pack");
    expect(deriveVerificationNeeded("free with github student")).toBe(
      "github_student_pack",
    );
  });

  it("maps academic email mentions to edu_email", () => {
    expect(deriveVerificationNeeded("Sign up with your .edu email")).toBe(
      "edu_email",
    );
    expect(
      deriveVerificationNeeded("Requires a university email address"),
    ).toBe("edu_email");
    expect(deriveVerificationNeeded("Verify with your college email")).toBe(
      "edu_email",
    );
    expect(deriveVerificationNeeded("academic email required")).toBe(
      "edu_email",
    );
  });

  it("maps student-ID verification mentions to student_id", () => {
    expect(deriveVerificationNeeded("Verify with SheerID")).toBe("student_id");
    expect(deriveVerificationNeeded("UNiDAYS verification required")).toBe(
      "student_id",
    );
    expect(deriveVerificationNeeded("upload your student ID")).toBe(
      "student_id",
    );
    expect(deriveVerificationNeeded("via Student Beans")).toBe("student_id");
    expect(deriveVerificationNeeded("ISIC card holders")).toBe("student_id");
    expect(deriveVerificationNeeded("proof of enrollment")).toBe("student_id");
  });

  it("defaults to none when nothing matches", () => {
    expect(deriveVerificationNeeded("Free forever, no signup needed")).toBe(
      "none",
    );
    expect(deriveVerificationNeeded("")).toBe("none");
  });

  it("is case-insensitive and prefers github_student_pack on overlap", () => {
    expect(
      deriveVerificationNeeded(
        "GitHub Student Developer Pack members verify with student ID",
      ),
    ).toBe("github_student_pack");
  });
});

describe("deriveCreditCardRequired", () => {
  it("maps no-credit-card phrasing to false", () => {
    expect(deriveCreditCardRequired("No credit card required")).toBe(false);
    expect(
      deriveCreditCardRequired("Sign up without a credit card"),
    ).toBe(false);
  });

  it("maps required-card phrasing to true", () => {
    expect(
      deriveCreditCardRequired("Credit card required after the trial"),
    ).toBe(true);
    expect(deriveCreditCardRequired("Requires a credit card to activate")).toBe(
      true,
    );
  });

  it("returns null when no signal is present", () => {
    expect(deriveCreditCardRequired("Free for students")).toBeNull();
    expect(deriveCreditCardRequired("")).toBeNull();
  });
});

describe("deriveDuration", () => {
  it("maps year-long phrasing to one_year", () => {
    expect(deriveDuration("Free for 1 year")).toBe("one_year");
    expect(deriveDuration("12 months of premium")).toBe("one_year");
    expect(deriveDuration("one year subscription")).toBe("one_year");
  });

  it("maps enrollment-bound phrasing to while_student", () => {
    expect(deriveDuration("Free while you are a student")).toBe(
      "while_student",
    );
    expect(deriveDuration("Renews while enrolled")).toBe("while_student");
    expect(deriveDuration("renewable each semester")).toBe("while_student");
  });

  it("maps lifetime phrasing to lifetime", () => {
    expect(deriveDuration("Lifetime access")).toBe("lifetime");
    expect(deriveDuration("yours forever")).toBe("lifetime");
  });

  it("maps single-use phrasing to one_time", () => {
    expect(deriveDuration("$100 one-time credit")).toBe("one_time");
    expect(deriveDuration("single use coupon")).toBe("one_time");
  });

  it("returns null when no signal is present", () => {
    expect(deriveDuration("Free for students")).toBeNull();
    expect(deriveDuration("")).toBeNull();
  });
});

describe("normalizeRawOffers", () => {
  it("populates verificationNeeded on every resource", () => {
    const { resources } = normalizeRawOffers([
      offer({ slug: "a", description: "Plain free tool" }),
      offer({
        slug: "b",
        description: "Needs a university email to claim",
      }),
    ]);
    expect(resources).toHaveLength(2);
    for (const r of resources) {
      expect(r.verificationNeeded).toBeDefined();
    }
    expect(resources[0].verificationNeeded).toBe("none");
    expect(resources[1].verificationNeeded).toBe("edu_email");
  });

  it("derives fields from extra_info notes and the offer tagline", () => {
    const { resources } = normalizeRawOffers([
      offer({
        slug: "c",
        offer: "Free for 1 year",
        description: "Cloud credits",
        extra_info: JSON.stringify({
          important_notes: [{ text: "No credit card required." }],
        }),
      }),
    ]);
    expect(resources[0].duration).toBe("one_year");
    expect(resources[0].creditCardRequired).toBe(false);
  });

  it("maps forever phrasing to lifetime and leaves creditCardRequired unset", () => {
    const { resources } = normalizeRawOffers([
      offer({ slug: "d", description: "Free forever, no strings attached" }),
    ]);
    expect(resources[0].creditCardRequired).toBeUndefined();
    expect(resources[0].duration).toBe("lifetime");
    expect(resources[0].verificationNeeded).toBe("none");
  });
});
