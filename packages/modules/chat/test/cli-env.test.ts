import { describe, expect, it } from "vitest";
import { cliEnv } from "../src/server/claude-cli";

describe("environment of the Claude CLI", () => {
  const source = {
    PATH: "/usr/bin", Path: undefined, HOME: "/home/o", USERPROFILE: "C:\\Users\\o", APPDATA: "x", TEMP: "t", SystemRoot: "C:\\Windows",
    ANTHROPIC_API_KEY: "k", CLAUDE_CODE_OAUTH_TOKEN: "t", CLAUDE_CONFIG_DIR: "d", AWS_REGION: "eu",
    FF_PASSWORD: "secret", FF_COOKIE_SECRET: "s", FF_DB: "db", FF_CLAUDE_CLI: "cli", GITHUB_TOKEN: "g", NPM_TOKEN: "n",
  };

  it("keeps what it needs to run and sign in, and drops the server's secrets and everything else", () => {
    const env = cliEnv(source);
    expect(Object.keys(env).sort()).toEqual(["ANTHROPIC_API_KEY", "APPDATA", "AWS_REGION", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR", "HOME", "PATH", "SystemRoot", "TEMP", "USERPROFILE"]);
  });

  it("matches names case-insensitively (Windows writes Path, ProgramFiles and so on in mixed case)", () => {
    expect(cliEnv({ Path: "p", ProgramFiles: "pf", "ProgramFiles(x86)": "x86", ff_password: "s" })).toEqual({ Path: "p", ProgramFiles: "pf", "ProgramFiles(x86)": "x86" });
  });
});
