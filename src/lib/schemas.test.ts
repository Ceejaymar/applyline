import { describe, expect, it } from "vitest";

import {
  archivedReasonSchema,
  companySchema,
  contactSchema,
  createJobSchema,
  jobContactRelationshipTypeSchema,
  jobSchema,
  updateJobSchema,
} from "./schemas";

const ISO = "2024-01-15T10:00:00.000Z";

describe("archivedReasonSchema", () => {
  it.each(["expired", "deleted", "role_filled", "not_interested", "other"])(
    "accepts %s",
    (value) => {
      expect(archivedReasonSchema.parse(value)).toBe(value);
    },
  );

  it("rejects unknown values", () => {
    expect(() => archivedReasonSchema.parse("unknown")).toThrow();
  });
});

describe("jobContactRelationshipTypeSchema", () => {
  it.each(["referral", "recruiter", "hiring_manager", "employee", "other"])(
    "accepts %s",
    (value) => {
      expect(jobContactRelationshipTypeSchema.parse(value)).toBe(value);
    },
  );
});

describe("jobSchema", () => {
  const valid = {
    id: "job_1",
    title: "Software Engineer",
    companyId: "company_1",
    columnId: "column_applied",
    lastStatusChangedAt: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    tags: [],
  };

  it("parses a valid job", () => {
    const result = jobSchema.parse(valid);
    expect(result.title).toBe("Software Engineer");
    expect(result.tags).toEqual([]);
  });

  it("rejects empty title", () => {
    expect(() => jobSchema.parse({ ...valid, title: "" })).toThrow();
  });

  it("rejects empty companyId", () => {
    expect(() => jobSchema.parse({ ...valid, companyId: "" })).toThrow();
  });

  it("accepts a valid URL for link", () => {
    const result = jobSchema.parse({ ...valid, link: "https://example.com/job" });
    expect(result.link).toBe("https://example.com/job");
  });

  it("accepts empty string for link", () => {
    expect(jobSchema.parse({ ...valid, link: "" }).link).toBe("");
  });

  it("rejects a non-URL link value", () => {
    expect(() => jobSchema.parse({ ...valid, link: "not-a-url" })).toThrow();
  });

  it("defaults tags to empty array when omitted", () => {
    const { tags: _, ...withoutTags } = valid;
    expect(jobSchema.parse(withoutTags).tags).toEqual([]);
  });
});

describe("companySchema", () => {
  const valid = {
    id: "company_1",
    name: "Acme Corp",
    createdAt: ISO,
    updatedAt: ISO,
  };

  it("parses a valid company", () => {
    expect(companySchema.parse(valid).name).toBe("Acme Corp");
  });

  it("rejects empty name", () => {
    expect(() => companySchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("accepts a valid website URL", () => {
    expect(companySchema.parse({ ...valid, website: "https://acme.com" }).website).toBe(
      "https://acme.com",
    );
  });

  it("accepts empty string for website", () => {
    expect(companySchema.parse({ ...valid, website: "" }).website).toBe("");
  });

  it("rejects an invalid website URL", () => {
    expect(() => companySchema.parse({ ...valid, website: "not-a-url" })).toThrow();
  });
});

describe("contactSchema", () => {
  const valid = {
    id: "contact_1",
    name: "Jane Doe",
    createdAt: ISO,
    updatedAt: ISO,
  };

  it("parses a valid contact", () => {
    expect(contactSchema.parse(valid).name).toBe("Jane Doe");
  });

  it("rejects empty name", () => {
    expect(() => contactSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("accepts a valid email", () => {
    expect(contactSchema.parse({ ...valid, email: "jane@example.com" }).email).toBe(
      "jane@example.com",
    );
  });

  it("accepts empty string for email", () => {
    expect(contactSchema.parse({ ...valid, email: "" }).email).toBe("");
  });

  it("rejects an invalid email", () => {
    expect(() => contactSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("accepts empty string for linkedin", () => {
    expect(contactSchema.parse({ ...valid, linkedin: "" }).linkedin).toBe("");
  });

  it("rejects an invalid LinkedIn URL", () => {
    expect(() => contactSchema.parse({ ...valid, linkedin: "not-a-url" })).toThrow();
  });
});

describe("createJobSchema", () => {
  it("rejects when neither companyId nor companyName is provided", () => {
    const result = createJobSchema.safeParse({ title: "Engineer" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.companyName).toBeDefined();
    }
  });

  it("passes when companyName is provided", () => {
    expect(createJobSchema.safeParse({ title: "Engineer", companyName: "Acme" }).success).toBe(
      true,
    );
  });

  it("passes when companyId is provided", () => {
    expect(
      createJobSchema.safeParse({ title: "Engineer", companyId: "company_1" }).success,
    ).toBe(true);
  });
});

describe("updateJobSchema", () => {
  it("rejects an empty object", () => {
    expect(() => updateJobSchema.parse({})).toThrow();
  });

  it("accepts a partial update", () => {
    expect(updateJobSchema.safeParse({ title: "New Title" }).success).toBe(true);
  });
});
