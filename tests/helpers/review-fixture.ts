import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  findingSchema,
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
  category: z.enum([
    "requirement_missing",
    "undocumented_behavior",
    "contradictory_evidence",
    "test_gap",
    "stale_documentation",
    "security",
    "other",
  ]),
  status: z.enum(["confirmed", "suspected", "inconclusive"]),
  recommendation: z.enum([
    "update_code",
    "update_documentation",
    "add_or_adjust_tests",
    "investigate",
    "accept_intentional_difference",
  ]),
  requiredEvidenceIds: z
    .array(z.string().min(1).max(160))
    .min(1)
    .max(1000)
    .optional(),
  minCount: z.number().int().nonnegative().default(1),
});

export const expectedSchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  fixtureId: z.string().min(1),
  outcome: expectedOutcomeSchema,
  minFindings: z.number().int().nonnegative(),
  maxFindings: z.number().int().nonnegative(),
  requiredMatches: z.array(semanticMatchSchema).max(1000),
  forbiddenCategories: z
    .array(semanticMatchSchema.shape.category)
    .max(1000)
    .optional(),
  forbiddenStatuses: z
    .array(semanticMatchSchema.shape.status)
    .max(1000)
    .optional(),
  rationale: z.string().min(1).max(4000),
});

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
  return `${JSON.stringify(value)}\n`;
}

export async function discoverReviewFixtures(
  fixturesRoot: string,
): Promise<ReviewFixtureDescriptor[]> {
  const entries = await readdir(fixturesRoot, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

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
  const files = new Set(
    (await readdir(descriptor.directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name),
  );

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
