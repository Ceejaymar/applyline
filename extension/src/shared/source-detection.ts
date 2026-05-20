import { type ApplylineJobDraft } from "./job-draft";

type SourceMatch = {
  id: NonNullable<ApplylineJobDraft["sourceId"]>;
  name: string;
  patterns: string[];
};

const SOURCE_MATCHES: SourceMatch[] = [
  { id: "source_linkedin", name: "LinkedIn", patterns: ["linkedin.com/jobs"] },
  { id: "source_indeed", name: "Indeed", patterns: ["indeed.com"] },
  { id: "source_wellfound", name: "Wellfound", patterns: ["wellfound.com", "angel.co"] },
  { id: "source_greenhouse", name: "Greenhouse", patterns: ["greenhouse.io"] },
  { id: "source_lever", name: "Lever", patterns: ["jobs.lever.co", "lever.co"] },
  { id: "source_workday", name: "Workday", patterns: ["workdayjobs.com", "myworkdayjobs.com"] },
];

export function detectSource(url: string): Pick<ApplylineJobDraft, "sourceId" | "sourceName"> {
  const normalizedUrl = url.toLocaleLowerCase();
  const match = SOURCE_MATCHES.find((source) =>
    source.patterns.some((pattern) => normalizedUrl.includes(pattern)),
  );

  if (match) {
    return { sourceId: match.id, sourceName: match.name };
  }

  return { sourceId: "source_company_website", sourceName: "Current page" };
}
