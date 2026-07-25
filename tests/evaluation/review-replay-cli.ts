import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import { join, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  REPLAY_INSTRUCTION_VERSION,
  REPLAY_SCHEMA_VERSION,
  buildReplayRunOutput,
  canonicalReplayStringify,
  loadReplayBundles,
  parseReplayCaptureSet,
  prepareReplayPackets,
  summarizeReplayRun,
} from "../helpers/review-replay.js";
import { discoverReviewFixtures, loadReviewFixture } from "../helpers/review-fixture.js";

type ParsedCommand =
  | { command: "prepare"; fixtures: string; output: string }
  | {
      command: "score";
      fixtures: string;
      captures: string;
      hostId: string;
      hostVersion: string;
      model: string;
      output: string;
    };

function usage(): string {
  return [
    "Usage:",
    "  review-replay-cli prepare --fixtures <dir> --output <dir>",
    "  review-replay-cli score --fixtures <dir> --captures <dir> --host-id <id> --host-version <version> --model <model> --output <dir>",
  ].join("\n");
}

function parseArguments(argv: readonly string[]): ParsedCommand {
  const [command, ...values] = argv;
  if (command !== "prepare" && command !== "score") {
    throw new Error(usage());
  }
  if (values.length % 2 !== 0) {
    throw new Error(usage());
  }
  const options = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined || options.has(key)) {
      throw new Error(usage());
    }
    options.set(key, value);
  }
  const required = command === "prepare"
    ? ["--fixtures", "--output"]
    : ["--fixtures", "--captures", "--host-id", "--host-version", "--model", "--output"];
  if (
    options.size !== required.length ||
    required.some((key) => !options.has(key))
  ) {
    throw new Error(usage());
  }
  const option = (name: string): string => {
    const value = options.get(name);
    if (!value) {
      throw new Error(usage());
    }
    return value;
  };
  if (command === "prepare") {
    return { command, fixtures: option("--fixtures"), output: option("--output") };
  }
  return {
    command,
    fixtures: option("--fixtures"),
    captures: option("--captures"),
    hostId: option("--host-id"),
    hostVersion: option("--host-version"),
    model: option("--model"),
    output: option("--output"),
  };
}

function outputPathComponents(output: string): string[] {
  const absolute = resolve(output);
  const root = parse(absolute).root;
  const remainder = relative(root, absolute);
  return [root, ...remainder.split(/[\\/]/u).filter(Boolean)];
}

/** Rejects links in the entire explicit output path before any write occurs. */
async function createEmptyOutputDirectory(output: string): Promise<string> {
  const components = outputPathComponents(output);
  let current = components[0] ?? "";
  for (const component of components.slice(1)) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new Error(`Output path must not traverse a symbolic link: ${current}`);
      }
      if (!info.isDirectory()) {
        throw new Error(`Output path component must be a directory: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      break;
    }
  }
  const absolute = resolve(output);
  await mkdir(absolute, { recursive: true });
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) {
    throw new Error("Output directory must not be a symbolic link");
  }
  if (!info.isDirectory()) {
    throw new Error("Output path must be a directory");
  }
  if ((await readdir(absolute)).length > 0) {
    throw new Error("Output directory must be empty and will not be overwritten");
  }
  return absolute;
}

async function writePreparation(fixturesDirectory: string, output: string): Promise<void> {
  const outputDirectory = await createEmptyOutputDirectory(output);
  const packets = prepareReplayPackets(await loadReplayBundles(fixturesDirectory));
  const promptsDirectory = join(outputDirectory, "prompts");
  await mkdir(promptsDirectory);
  for (const packet of packets) {
    await writeFile(
      join(promptsDirectory, `${packet.fixtureId}.json`),
      canonicalReplayStringify(packet),
      "utf8",
    );
  }
  await writeFile(
    join(outputDirectory, "manifest.json"),
    canonicalReplayStringify({
      schemaVersion: REPLAY_SCHEMA_VERSION,
      instructionVersion: REPLAY_INSTRUCTION_VERSION,
      packets: packets.map((packet) => ({
        fixtureId: packet.fixtureId,
        bundleSha256: packet.bundleSha256,
        file: `prompts/${packet.fixtureId}.json`,
      })),
    }),
    "utf8",
  );
}

async function writeScore(command: Extract<ParsedCommand, { command: "score" }>): Promise<boolean> {
  const outputDirectory = await createEmptyOutputDirectory(command.output);
  const fixtures = await Promise.all(
    (await discoverReviewFixtures(command.fixtures)).map(loadReviewFixture),
  );
  const output = buildReplayRunOutput(
    fixtures,
    await parseReplayCaptureSet(command.captures),
    {
      hostId: command.hostId,
      hostVersion: command.hostVersion,
      model: command.model,
    },
  );
  await writeFile(join(outputDirectory, "score.json"), canonicalReplayStringify(output), "utf8");
  await writeFile(join(outputDirectory, "summary.md"), summarizeReplayRun(output), "utf8");
  return output.suiteScore.passed;
}

export async function main(argv: readonly string[]): Promise<number> {
  try {
    const command = parseArguments(argv);
    if (command.command === "prepare") {
      await writePreparation(command.fixtures, command.output);
      return 0;
    }
    const passed = await writeScore(command);
    if (!passed) {
      process.stderr.write("Review replay suite failed.\n");
      return 1;
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
