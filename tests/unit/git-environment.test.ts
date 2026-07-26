import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectChangeScope,
  createGitEnvironment,
} from "../../src/git/change-scope.js";
import { materializeGitFixture } from "../helpers/git-fixture.js";

function fixtureDirectory(name: string): string {
  return fileURLToPath(new URL(`../fixtures/git/${name}`, import.meta.url));
}

describe("fixed Git environment", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnvironment)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnvironment);
  });

  it("uses canonical keys from case-insensitive Windows sources exactly once", () => {
    const environment = createGitEnvironment(
      {
        Path: "C:\\Windows\\System32",
        systemroot: "C:\\Windows",
        USERPROFILE: "C:\\Users\\fixture",
        tmp: "C:\\Temp",
        GIT_DIR: "C:\\poisoned",
        SECRET_TOKEN: "secret-shaped-value",
      },
      "win32",
    );

    expect(environment).toEqual({
      PATH: "C:\\Windows\\System32",
      SystemRoot: "C:\\Windows",
      USERPROFILE: "C:\\Users\\fixture",
      TMP: "C:\\Temp",
      GIT_PAGER: "cat",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    });
    expect(Object.keys(environment).filter((key) => key.toLowerCase() === "path")).toEqual(["PATH"]);
  });

  it("uses exact POSIX keys, omits missing values, and emits only allowed keys", () => {
    const environment = createGitEnvironment(
      {
        PATH: "/usr/bin",
        Path: "/poisoned",
        HOME: "/home/fixture",
        TMPDIR: "",
        GIT_WORK_TREE: "/poisoned",
        GIT_CONFIG_COUNT: "1",
        GIT_EXTERNAL_DIFF: "hostile-diff",
        GIT_TRACE: "1",
        NODE_OPTIONS: "--require hostile-loader",
        HTTPS_PROXY: "http://proxy.invalid",
        ACCESS_TOKEN: "secret-shaped-value",
      },
      "linux",
    );

    expect(environment).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/fixture",
      GIT_PAGER: "cat",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    });
  });

  it("keeps real fixed-Git collection on the intended repository with a poisoned parent environment", async () => {
    const fixture = await materializeGitFixture(fixtureDirectory("basic-change"));
    Object.assign(process.env, {
      GIT_DIR: "C:\\poisoned-git-dir",
      GIT_WORK_TREE: "C:\\poisoned-git-work-tree",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.pager",
      GIT_CONFIG_VALUE_0: "hostile-pager",
      GIT_EXTERNAL_DIFF: "hostile-diff",
      GIT_PAGER: "hostile-pager",
      GIT_TERMINAL_PROMPT: "1",
      GIT_TRACE: "secret-shaped-trace",
      NODE_OPTIONS: "--require hostile-loader",
    });
    try {
      const scope = await collectChangeScope({
        repositoryPath: fixture.repositoryPath,
        baseRef: fixture.baseObjectId,
        headRef: fixture.headObjectId,
      });
      expect(scope.repositoryRoot).toBe(fixture.repositoryPath);
      expect(scope.files.map(({ path }) => path)).toEqual(["src/greeting.ts", "tests/greeting.test.ts"]);
      expect(createGitEnvironment()).not.toHaveProperty("GIT_DIR");
      expect(createGitEnvironment()).not.toHaveProperty("NODE_OPTIONS");
    } finally {
      await fixture.cleanup();
    }
  });
});
