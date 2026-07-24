import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  findingCategorySchema,
  findingRecommendationSchema,
  findingSchema,
  findingStatusSchema,
  reviewBundleSchema,
  type Finding,
  type ReviewBundle,
} from "../../src/schemas/index.js";

export const EXPECTED_FIXTURE_IDS = [
  "implemented-correctly",
  "requirement-missing",
  "undocumented-behavior",
  "intentional-doc-free-refactor",
  "contradictory-documents",
  "missing-permissions",
  "stale-documentation",
  "malicious-instruction",
  "insufficient-evidence",
] as const;

export const EXPECTED_FILES = [
  "bundle.json",
  "reference-findings.json",
  "expected.json",
] as const;

const expectedOutcomeSchema = z.enum([
  "no_findings",
  "findings",
  "inconclusive",
]);

const semanticMatchSchema = z.strictObject({
  category: findingCategorySchema,
  status: findingStatusSchema,
  recommendation: findingRecommendationSchema,
  requiredEvidenceIds: z
    .array(z.string().min(1).max(160))
    .min(1)
    .max(1000)
    .optional(),
  minCount: z.number().int().positive().default(1),
});

const expectedSchemaBase = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  fixtureId: z.string().min(1),
  outcome: expectedOutcomeSchema,
  minFindings: z.number().int().nonnegative(),
  maxFindings: z.number().int().nonnegative(),
  requiredMatches: z.array(semanticMatchSchema).max(1000),
  forbiddenCategories: z.array(findingCategorySchema).max(1000).optional(),
  forbiddenStatuses: z.array(findingStatusSchema).max(1000).optional(),
  rationale: z.string().min(1).max(4000),
});

export const expectedSchema = expectedSchemaBase.superRefine(
  (expected, context) => {
    if (expected.minFindings > expected.maxFindings) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minFindings"],
        message: "minFindings must not exceed maxFindings",
      });
    }

    if (expected.outcome === "no_findings") {
      if (expected.minFindings !== 0 || expected.maxFindings !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["outcome"],
          message: "no_findings requires zero minimum and maximum findings",
        });
      }
      if (expected.requiredMatches.length !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredMatches"],
          message: "no_findings cannot require semantic matches",
        });
      }
    } else {
      if (expected.minFindings < 1 || expected.requiredMatches.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["outcome"],
          message: "findings and inconclusive outcomes require non-empty findings and semantic matches",
        });
      }
    }

    if (expected.outcome === "inconclusive") {
      const forbiddenStatuses = new Set(expected.forbiddenStatuses ?? []);
      if (
        !forbiddenStatuses.has("confirmed") ||
        !forbiddenStatuses.has("suspected")
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["forbiddenStatuses"],
          message: "inconclusive outcomes must forbid confirmed and suspected findings",
        });
      }
    }
  },
);

export type ExpectedOutcome = z.infer<typeof expectedSchema>;
export type SemanticMatch = z.infer<typeof semanticMatchSchema>;

export type ReviewFixtureDescriptor = {
  fixtureId: string;
  directory: string;
  bundlePath: string;
  referenceFindingsPath: string;
  expectedPath: string;
};

export type LoadedReviewFixture = {
  descriptor: ReviewFixtureDescriptor;
  bundle: ReviewBundle;
  referenceFindings: Finding[];
  expected: ExpectedOutcome;
};

export function canonicalStringify(value: unknown): string {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\r\n?/gu, "\n");
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export async function discoverReviewFixtures(
  fixturesRoot: string,
): Promise<ReviewFixtureDescriptor[]> {
  const entries = await readdir(fixturesRoot, { withFileTypes: true });
  const issues: string[] = [];
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      issues.push(`Unexpected symbolic link ${entry.name} in fixture root`);
    } else if (!entry.isDirectory()) {
      issues.push(`Unexpected non-directory entry ${entry.name} in fixture root`);
    } else if (!(EXPECTED_FIXTURE_IDS as readonly string[]).includes(entry.name)) {
      issues.push(`Unexpected fixture directory ${entry.name}`);
    } else {
      dirs.push(entry.name);
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join("; "));
  }

  dirs.sort();

  return dirs.map((name) => {
    const directory = join(fixturesRoot, name);
    return {
      fixtureId: name,
      directory,
      bundlePath: join(directory, "bundle.json"),
      referenceFindingsPath: join(directory, "reference-findings.json"),
      expectedPath: join(directory, "expected.json"),
    };
  });
}

export async function validateFixtureDirectory(
  descriptor: ReviewFixtureDescriptor,
): Promise<string[]> {
  const issues: string[] = [];
  const files = new Set<string>();
  for (const entry of await readdir(descriptor.directory, {
    withFileTypes: true,
  })) {
    if (entry.isSymbolicLink()) {
      issues.push(`Unexpected symbolic link ${entry.name} in ${descriptor.fixtureId}`);
    } else if (!entry.isFile()) {
      issues.push(`Unexpected non-file entry ${entry.name} in ${descriptor.fixtureId}`);
    } else {
      files.add(entry.name);
    }
  }

  for (const expectedFile of EXPECTED_FILES) {
    if (!files.has(expectedFile)) {
      issues.push(
        `Missing required file ${expectedFile} in ${descriptor.fixtureId}`,
      );
    }
  }

  for (const file of files) {
    if (!(EXPECTED_FILES as readonly string[]).includes(file)) {
      issues.push(
        `Unexpected file ${file} in ${descriptor.fixtureId}`,
      );
    }
  }

  return issues;
}

export async function loadReviewFixture(
  descriptor: ReviewFixtureDescriptor,
): Promise<LoadedReviewFixture> {
  const issues = await validateFixtureDirectory(descriptor);
  if (issues.length > 0) {
    throw new Error(
      `Invalid review fixture ${descriptor.fixtureId}: ${issues.join("; ")}`,
    );
  }
  const [bundleRaw, findingsRaw, expectedRaw] = await Promise.all([
    readFile(descriptor.bundlePath, "utf-8"),
    readFile(descriptor.referenceFindingsPath, "utf-8"),
    readFile(descriptor.expectedPath, "utf-8"),
  ]);

  const bundle = reviewBundleSchema.parse(JSON.parse(bundleRaw));
  const referenceFindings = z
    .array(findingSchema)
    .parse(JSON.parse(findingsRaw));
  const expected = expectedSchema.parse(JSON.parse(expectedRaw));

  return {
    descriptor,
    bundle,
    referenceFindings,
    expected,
  };
}
