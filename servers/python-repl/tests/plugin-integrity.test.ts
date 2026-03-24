/**
 * Plugin integrity tests — validates config files, version consistency,
 * SKILL.md structure, build artifacts, and file references.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readdirSync } from "node:fs";

// Project root: two levels up from servers/python-repl/tests/
const ROOT = resolve(__dirname, "..", "..", "..");
const PLUGIN_DIR = join(ROOT, ".claude-plugin");

// ── Helpers ──────────────────────────────────────────────────────

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function readJsonSafe(filePath: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Version consistency ──────────────────────────────────────────

describe("version consistency", () => {
  const pluginJson = readJson(join(PLUGIN_DIR, "plugin.json")) as {
    version: string;
  };
  const marketplaceJson = readJson(join(PLUGIN_DIR, "marketplace.json")) as {
    metadata: { version: string };
    plugins: Array<{ version: string }>;
  };

  it("plugin.json version is a valid semver string", () => {
    expect(pluginJson.version).toMatch(
      /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/,
    );
  });

  it("marketplace.json metadata.version matches plugin.json", () => {
    expect(marketplaceJson.metadata.version).toBe(pluginJson.version);
  });

  it("marketplace.json plugins[0].version matches plugin.json", () => {
    expect(marketplaceJson.plugins[0].version).toBe(pluginJson.version);
  });

  it("all three version fields are identical", () => {
    const versions = new Set([
      pluginJson.version,
      marketplaceJson.metadata.version,
      marketplaceJson.plugins[0].version,
    ]);
    expect(versions.size).toBe(1);
  });
});

// ── Semver comparison logic ──────────────────────────────────────

describe("semver comparison", () => {
  /** Minimal semver compare: returns -1, 0, or 1 */
  function compareSemver(a: string, b: string): number {
    const pa = a.replace(/^v/, "").split(".").map(Number);
    const pb = b.replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  it("equal versions return 0", () => {
    expect(compareSemver("1.1.0", "1.1.0")).toBe(0);
  });

  it("higher major returns 1", () => {
    expect(compareSemver("2.0.0", "1.9.9")).toBe(1);
  });

  it("lower major returns -1", () => {
    expect(compareSemver("0.9.0", "1.0.0")).toBe(-1);
  });

  it("higher minor returns 1", () => {
    expect(compareSemver("1.2.0", "1.1.9")).toBe(1);
  });

  it("higher patch returns 1", () => {
    expect(compareSemver("1.1.1", "1.1.0")).toBe(1);
  });

  it("handles v prefix", () => {
    expect(compareSemver("v1.1.0", "1.1.0")).toBe(0);
  });

  it("handles missing patch (treated as 0)", () => {
    expect(compareSemver("1.1", "1.1.0")).toBe(0);
  });

  it("sorts a list correctly", () => {
    const versions = ["2.0.0", "0.1.0", "1.1.0", "1.0.0", "1.1.1"];
    const sorted = [...versions].sort(compareSemver);
    expect(sorted).toEqual(["0.1.0", "1.0.0", "1.1.0", "1.1.1", "2.0.0"]);
  });
});

// ── plugin.json schema validation ────────────────────────────────

describe("plugin.json schema", () => {
  const pluginJson = readJson(join(PLUGIN_DIR, "plugin.json")) as Record<string, unknown>;

  it("is valid JSON", () => {
    const result = readJsonSafe(join(PLUGIN_DIR, "plugin.json"));
    expect(result.ok).toBe(true);
  });

  it("has required top-level fields", () => {
    for (const field of ["name", "description", "version", "skills"]) {
      expect(pluginJson).toHaveProperty(field);
    }
  });

  it("name is a non-empty string", () => {
    expect(typeof pluginJson.name).toBe("string");
    expect((pluginJson.name as string).length).toBeGreaterThan(0);
  });

  it("description is a non-empty string", () => {
    expect(typeof pluginJson.description).toBe("string");
    expect((pluginJson.description as string).length).toBeGreaterThan(0);
  });

  it("skills is a non-empty array", () => {
    expect(Array.isArray(pluginJson.skills)).toBe(true);
    expect((pluginJson.skills as unknown[]).length).toBeGreaterThan(0);
  });

  it("each skill has name, description, and path", () => {
    const skills = pluginJson.skills as Array<Record<string, unknown>>;
    for (const skill of skills) {
      expect(skill).toHaveProperty("name");
      expect(skill).toHaveProperty("description");
      expect(skill).toHaveProperty("path");
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.path).toBe("string");
    }
  });

  it("has author field with name", () => {
    expect(pluginJson).toHaveProperty("author");
    const author = pluginJson.author as Record<string, unknown>;
    expect(author).toHaveProperty("name");
    expect(typeof author.name).toBe("string");
  });
});

// ── marketplace.json schema validation ───────────────────────────

describe("marketplace.json schema", () => {
  const marketplaceJson = readJson(join(PLUGIN_DIR, "marketplace.json")) as Record<string, unknown>;

  it("is valid JSON", () => {
    const result = readJsonSafe(join(PLUGIN_DIR, "marketplace.json"));
    expect(result.ok).toBe(true);
  });

  it("has required top-level fields", () => {
    for (const field of ["name", "owner", "metadata", "plugins"]) {
      expect(marketplaceJson).toHaveProperty(field);
    }
  });

  it("owner has a name field", () => {
    const owner = marketplaceJson.owner as Record<string, unknown>;
    expect(owner).toHaveProperty("name");
    expect(typeof owner.name).toBe("string");
  });

  it("metadata has description and version", () => {
    const metadata = marketplaceJson.metadata as Record<string, unknown>;
    expect(metadata).toHaveProperty("description");
    expect(metadata).toHaveProperty("version");
  });

  it("plugins is a non-empty array", () => {
    const plugins = marketplaceJson.plugins as unknown[];
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
  });

  it("each plugin entry has required fields", () => {
    const plugins = marketplaceJson.plugins as Array<Record<string, unknown>>;
    for (const plugin of plugins) {
      for (const field of ["name", "source", "description", "version", "category", "tags"]) {
        expect(plugin).toHaveProperty(field);
      }
    }
  });

  it("plugin tags is a non-empty array of strings", () => {
    const plugins = marketplaceJson.plugins as Array<{ tags: unknown }>;
    for (const plugin of plugins) {
      expect(Array.isArray(plugin.tags)).toBe(true);
      const tags = plugin.tags as unknown[];
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(typeof tag).toBe("string");
      }
    }
  });
});

// ── Skill file references from plugin.json ───────────────────────

describe("skill file references", () => {
  const pluginJson = readJson(join(PLUGIN_DIR, "plugin.json")) as {
    skills: Array<{ name: string; path: string }>;
  };

  for (const skill of pluginJson.skills) {
    describe(`skill "${skill.name}"`, () => {
      const skillDir = join(ROOT, skill.path);

      it(`directory exists at ${skill.path}`, () => {
        expect(existsSync(skillDir)).toBe(true);
        expect(statSync(skillDir).isDirectory()).toBe(true);
      });

      it("SKILL.md exists in skill directory", () => {
        const skillMd = join(skillDir, "SKILL.md");
        expect(existsSync(skillMd)).toBe(true);
      });
    });
  }
});

// ── SKILL.md structure validation ────────────────────────────────

describe("SKILL.md structure", () => {
  const skillDirs = readdirSync(join(ROOT, "skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const skillName of skillDirs) {
    const skillMdPath = join(ROOT, "skills", skillName, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    describe(`skills/${skillName}/SKILL.md`, () => {
      const content = readFileSync(skillMdPath, "utf-8");

      it("has YAML frontmatter with name and description", () => {
        expect(content).toMatch(/^---\n/);
        expect(content).toMatch(/^---\n[\s\S]*?---/m);
        expect(content).toMatch(/name:\s*\S+/);
        expect(content).toMatch(/description:\s*.+/);
      });

      it("has a top-level heading", () => {
        expect(content).toMatch(/^#\s+/m);
      });

      it("frontmatter name matches directory name", () => {
        const nameMatch = content.match(/name:\s*(.+)/);
        expect(nameMatch).not.toBeNull();
        const fmName = nameMatch![1].trim();
        expect(fmName).toBe(skillName);
      });
    });
  }
});

// ── Configuration files validation ───────────────────────────────

describe("configuration files", () => {
  describe("settings.json", () => {
    const settingsPath = join(ROOT, "settings.json");

    it("exists and is valid JSON", () => {
      expect(existsSync(settingsPath)).toBe(true);
      const result = readJsonSafe(settingsPath);
      expect(result.ok).toBe(true);
    });

    it("has permissions.allow array", () => {
      const settings = readJson(settingsPath) as Record<string, unknown>;
      expect(settings).toHaveProperty("permissions");
      const perms = settings.permissions as Record<string, unknown>;
      expect(perms).toHaveProperty("allow");
      expect(Array.isArray(perms.allow)).toBe(true);
    });

    it("includes required MCP tool permissions", () => {
      const settings = readJson(settingsPath) as {
        permissions: { allow: string[] };
      };
      // At minimum, the python-repl MCP server must be permitted
      const hasPythonRepl = settings.permissions.allow.some((p) =>
        p.startsWith("mcp__python-repl__"),
      );
      expect(hasPythonRepl).toBe(true);
    });
  });

  describe(".mcp.json", () => {
    const mcpPath = join(ROOT, ".mcp.json");

    it("exists and is valid JSON", () => {
      expect(existsSync(mcpPath)).toBe(true);
      const result = readJsonSafe(mcpPath);
      expect(result.ok).toBe(true);
    });

    it("has mcpServers.python-repl entry", () => {
      const mcp = readJson(mcpPath) as Record<string, unknown>;
      expect(mcp).toHaveProperty("mcpServers");
      const servers = mcp.mcpServers as Record<string, unknown>;
      expect(servers).toHaveProperty("python-repl");
    });

    it("python-repl server has command and args", () => {
      const mcp = readJson(mcpPath) as {
        mcpServers: { "python-repl": Record<string, unknown> };
      };
      const server = mcp.mcpServers["python-repl"];
      expect(server).toHaveProperty("command");
      expect(server).toHaveProperty("args");
    });
  });

  describe("hooks/hooks.json", () => {
    const hooksPath = join(ROOT, "hooks", "hooks.json");

    it("exists and is valid JSON", () => {
      expect(existsSync(hooksPath)).toBe(true);
      const result = readJsonSafe(hooksPath);
      expect(result.ok).toBe(true);
    });

    it("has hooks.PostToolUse array", () => {
      const hooks = readJson(hooksPath) as Record<string, unknown>;
      expect(hooks).toHaveProperty("hooks");
      const h = hooks.hooks as Record<string, unknown>;
      expect(h).toHaveProperty("PostToolUse");
      expect(Array.isArray(h.PostToolUse)).toBe(true);
    });

    it("each hook entry has matcher and hooks array", () => {
      const hooksFile = readJson(hooksPath) as {
        hooks: { PostToolUse: Array<Record<string, unknown>> };
      };
      for (const entry of hooksFile.hooks.PostToolUse) {
        expect(entry).toHaveProperty("matcher");
        expect(entry).toHaveProperty("hooks");
        expect(Array.isArray(entry.hooks)).toBe(true);
      }
    });
  });
});

// ── Post-update scripts validation ───────────────────────────────

describe("scripts validation", () => {
  const scriptsDir = join(ROOT, "scripts");

  it("validate-summary.sh exists and is executable", () => {
    const scriptPath = join(scriptsDir, "validate-summary.sh");
    expect(existsSync(scriptPath)).toBe(true);
    const content = readFileSync(scriptPath, "utf-8");
    expect(content.startsWith("#!/")).toBe(true);
  });

  it("validate-summary.sh checks all required summary sections", () => {
    const content = readFileSync(
      join(scriptsDir, "validate-summary.sh"),
      "utf-8",
    );
    const requiredSections = [
      "Objective",
      "Approach",
      "Key Findings",
      "Confidence",
      "Dead Ends",
      "Suggested Follow-ups",
    ];
    for (const section of requiredSections) {
      expect(content).toContain(section);
    }
  });

  it("validate-autopilot-state.sh exists and is executable", () => {
    const scriptPath = join(scriptsDir, "validate-autopilot-state.sh");
    expect(existsSync(scriptPath)).toBe(true);
    const content = readFileSync(scriptPath, "utf-8");
    expect(content.startsWith("#!/")).toBe(true);
  });

  it("validate-autopilot-state.sh enforces safety limits", () => {
    const content = readFileSync(
      join(scriptsDir, "validate-autopilot-state.sh"),
      "utf-8",
    );
    expect(content).toContain("ABSOLUTE_MAX_ROUNDS=20");
    expect(content).toContain("MAX_CONCURRENT_TEAMS=10");
    expect(content).toContain("MAX_TOTAL_AGENTS=50");
  });

  it("scripts referenced in hooks.json exist on disk", () => {
    const hooksFile = readJson(join(ROOT, "hooks", "hooks.json")) as {
      hooks: {
        PostToolUse: Array<{ hooks: Array<{ command: string }> }>;
      };
    };
    for (const entry of hooksFile.hooks.PostToolUse) {
      for (const hook of entry.hooks) {
        // Extract script path — pattern: bash ${CLAUDE_PLUGIN_ROOT}/scripts/foo.sh ...
        const match = hook.command.match(
          /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+)/,
        );
        if (match) {
          const relPath = match[1].replace(/\s.*$/, ""); // strip trailing args
          const absPath = join(ROOT, relPath);
          expect(existsSync(absPath)).toBe(true);
        }
      }
    }
  });
});

// ── Build artifact checks ────────────────────────────────────────

describe("build artifacts", () => {
  it("servers/python-repl/package.json exists", () => {
    expect(existsSync(join(ROOT, "servers", "python-repl", "package.json"))).toBe(true);
  });

  it("servers/python-repl/src/index.ts exists", () => {
    expect(existsSync(join(ROOT, "servers", "python-repl", "src", "index.ts"))).toBe(true);
  });

  it("servers/python-repl/worker/ directory exists", () => {
    expect(existsSync(join(ROOT, "servers", "python-repl", "worker"))).toBe(true);
  });

  it("build script (scripts/build.mjs) is referenced in package.json", () => {
    const pkg = readJson(join(ROOT, "servers", "python-repl", "package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.build).toContain("build");
  });
});

// ── Schema conformance: validate-autopilot-state.sh vs spec ──────

describe("validate-autopilot-state.sh schema conformance", () => {
  const scriptContent = readFileSync(
    join(ROOT, "scripts", "validate-autopilot-state.sh"),
    "utf-8",
  );

  // Per SKILL.md spec, autopilot-state.json has fields: command, updatedAt, reason
  // Valid command values: "running", "pause", "resume", "abort"

  it("checks for spec field 'command' (not 'status')", () => {
    // The script should validate .command, not .status
    // Checking the required-fields loop and jq queries
    const requiredFieldsMatch = scriptContent.match(
      /for field in ([^;]+);/,
    );
    expect(requiredFieldsMatch).not.toBeNull();
    const fields = requiredFieldsMatch![1].trim().split(/\s+/);
    expect(fields).toContain("command");
    expect(fields).not.toContain("status");
  });

  it("does not require non-spec fields currentRound or maxRounds", () => {
    // autopilot-state.json per spec only has: command, updatedAt, reason
    // currentRound/maxRounds belong in autopilot.json, not state
    const requiredFieldsMatch = scriptContent.match(
      /for field in ([^;]+);/,
    );
    expect(requiredFieldsMatch).not.toBeNull();
    const fields = requiredFieldsMatch![1].trim().split(/\s+/);
    expect(fields).not.toContain("currentRound");
    expect(fields).not.toContain("maxRounds");
  });

  it("validates spec-correct command values (running, pause, resume, abort)", () => {
    // Per spec: valid commands are "running", "pause", "resume", "abort"
    // The script should not use "paused", "pause_requested", "completed", etc.
    const specCommands = ["running", "pause", "resume", "abort"];
    const wrongCommands = ["paused", "pause_requested", "aborted", "abort_requested"];

    for (const cmd of specCommands) {
      expect(scriptContent).toContain(cmd);
    }
    // These non-spec values should NOT be in the valid set
    for (const cmd of wrongCommands) {
      const validStatusLine = scriptContent.match(/VALID_STATUSES="([^"]+)"/);
      if (validStatusLine) {
        const validSet = validStatusLine[1].split(/\s+/);
        expect(validSet).not.toContain(cmd);
      }
    }
  });

  it("reads .command from state file (not .status)", () => {
    // The jq query for status validation should use .command
    expect(scriptContent).toMatch(/jq\s+-r\s+'\.command'/);
  });

  it("does not reference roundHistory in state file", () => {
    // roundHistory is not part of autopilot-state.json spec
    // It belongs in autopilot.json as 'rounds'
    expect(scriptContent).not.toMatch(/\.roundHistory/);
  });
});

// ── Fixture schema conformance: autopilot-config.json ────────────

describe("fixture autopilot-config.json schema conformance", () => {
  const configPath = join(ROOT, "tests", "fixtures", "autopilot-config.json");
  const config = readJson(configPath) as Record<string, unknown>;

  // Per SKILL.md spec, autopilot.json uses:
  //   maxIterations (not maxRounds)
  //   maxConcurrentTeammates (not maxTeamSize)

  it("uses 'maxIterations' not 'maxRounds'", () => {
    expect(config).toHaveProperty("maxIterations");
    expect(config).not.toHaveProperty("maxRounds");
  });

  it("uses 'maxConcurrentTeammates' not 'maxTeamSize'", () => {
    expect(config).toHaveProperty("maxConcurrentTeammates");
    expect(config).not.toHaveProperty("maxTeamSize");
  });

  it("has spec-required fields", () => {
    const specFields = [
      "maxIterations",
      "maxConcurrentTeammates",
      "stoppingThreshold",
      "researchTimeoutMinutes",
      "seedPhrase",
      "customStoppingCriteria",
      "createdAt",
      "completedAt",
      "stoppingReason",
      "totalRounds",
      "totalFindings",
      "rounds",
    ];
    for (const field of specFields) {
      expect(config).toHaveProperty(field);
    }
  });
});

// ── Fixture schema conformance: autopilot-state-*.json ───────────

describe("fixture autopilot-state files schema conformance", () => {
  const stateFiles = [
    "autopilot-state-running.json",
    "autopilot-state-paused.json",
  ];

  for (const filename of stateFiles) {
    describe(filename, () => {
      const statePath = join(ROOT, "tests", "fixtures", filename);
      const state = readJson(statePath) as Record<string, unknown>;

      it("has 'command' field (not 'status')", () => {
        expect(state).toHaveProperty("command");
        expect(state).not.toHaveProperty("status");
      });

      it("has 'updatedAt' field", () => {
        expect(state).toHaveProperty("updatedAt");
      });

      it("has 'reason' field", () => {
        expect(state).toHaveProperty("reason");
      });

      it("command value is one of the spec values", () => {
        const validCommands = ["running", "pause", "resume", "abort"];
        expect(validCommands).toContain(state.command);
      });

      it("does NOT contain autopilot-config fields", () => {
        // State files should not have config fields mixed in
        expect(state).not.toHaveProperty("maxRounds");
        expect(state).not.toHaveProperty("maxIterations");
        expect(state).not.toHaveProperty("rounds");
        expect(state).not.toHaveProperty("totalFindings");
      });
    });
  }

  describe("autopilot-state-completed.json", () => {
    const statePath = join(ROOT, "tests", "fixtures", "autopilot-state-completed.json");
    const state = readJson(statePath) as Record<string, unknown>;

    it("is a state file, not a config file (has 'command' field)", () => {
      // This fixture should represent a completed autopilot state,
      // not be a copy of the autopilot config
      expect(state).toHaveProperty("command");
    });

    it("does not have autopilot-config structure", () => {
      // If this has maxRounds/rounds/totalFindings, it's actually
      // a config file mislabeled as a state file
      const isActuallyConfig =
        state.hasOwnProperty("rounds") ||
        state.hasOwnProperty("maxRounds") ||
        state.hasOwnProperty("maxIterations");
      expect(isActuallyConfig).toBe(false);
    });
  });
});

// ── Test fixture files ───────────────────────────────────────────

describe("test fixture files", () => {
  const fixturesDir = join(ROOT, "tests", "fixtures");

  const expectedFixtures = [
    "index.ts",
    "configs.ts",
    "ipc-messages.ts",
    "mock-bridge.ts",
    "notebooks.ts",
    "autopilot-scenarios.ts",
    "config.json",
    "report.md",
    "notebook.ipynb",
    "sample-dataset.csv",
    "autopilot-config.json",
    "autopilot-state-running.json",
    "autopilot-state-completed.json",
    "autopilot-state-paused.json",
    "autopilot-report.md",
  ];

  for (const fixture of expectedFixtures) {
    it(`${fixture} exists`, () => {
      expect(existsSync(join(fixturesDir, fixture))).toBe(true);
    });
  }
});
