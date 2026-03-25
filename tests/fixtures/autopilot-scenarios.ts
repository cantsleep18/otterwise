/**
 * Test scenarios for autopilot infinite expansion, pause/abort, and resume-from-existing.
 *
 * Usage:
 *   import { scenarios, autopilotConfigs, autopilotStates } from "../fixtures/autopilot-scenarios.js";
 */

// ── AutopilotNode type (graph-based expansion) ──

export interface AutopilotNode {
  reportId: string;
  parentIds: string[];
  status: "completed" | "in-progress" | "timeout" | "failed";
  teamName: string;
  findings_count: number;
  decisionScore: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface CooldownEntry {
  candidateId: string;
  consecutiveFailures: number;
  lastFailedAt: string;
}

export interface AutopilotConfig {
  $schema?: string;
  status: "running" | "aborted";
  maxConcurrentTeammates: number;
  researchTimeoutMinutes: number;
  explorationStrategy: "balanced" | "breadth-first" | "depth-first";
  seedPhrase: string;
  scope: {
    focusAreas: string[] | null;
    excludeTopics: string[] | null;
    depthLimit: number;
  };
  notifications: {
    progressUpdates: string;
  };
  createdAt: string;
  totalNodes: number;
  totalFindings: number;
  cooldown?: CooldownEntry[];
  nodes: AutopilotNode[];
}

// ── AutopilotState type (control signal file) ──

export interface AutopilotState {
  command: "running" | "pause" | "abort";
  updatedAt: string;
  reason: string | null;
}

// ── Config fixtures ──────────────────────────────────────────────

export const autopilotConfigs = {
  /** Fresh session — balanced defaults, no nodes yet */
  balanced: {
    $schema: "autopilot-config",
    status: "running",
    maxConcurrentTeammates: 3,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    totalNodes: 0,
    totalFindings: 0,
    cooldown: [],
    nodes: [],
  } satisfies AutopilotConfig,

  /** Deep investigation with depth-first strategy */
  deepAnalysis: {
    $schema: "autopilot-config",
    status: "running",
    maxConcurrentTeammates: 5,
    researchTimeoutMinutes: 60,
    explorationStrategy: "depth-first",
    seedPhrase: "autopilot-20260323-170000",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 8,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T17:00:00.000Z",
    totalNodes: 0,
    totalFindings: 0,
    cooldown: [],
    nodes: [],
  } satisfies AutopilotConfig,

  /** Session with existing nodes — used for resume-from-existing tests */
  withExistingNodes: {
    $schema: "autopilot-config",
    status: "running",
    maxConcurrentTeammates: 3,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    totalNodes: 3,
    totalFindings: 15,
    cooldown: [],
    nodes: [
      {
        reportId: "20260323_143015_a1b2c3d4_initial-profiling",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial-profiling",
        findings_count: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4e5f6_correlation-deep-dive",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep-dive",
        findings_count: 4,
        decisionScore: 0.82,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_144615_e5f6a7b8_distribution-analysis",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-144615-distribution-analysis",
        findings_count: 6,
        decisionScore: 0.75,
        startedAt: "2026-03-23T14:46:20.000Z",
        completedAt: "2026-03-23T14:53:45.000Z",
      },
    ],
  } satisfies AutopilotConfig,

  /** Aborted session */
  aborted: {
    $schema: "autopilot-config",
    status: "aborted",
    maxConcurrentTeammates: 3,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    totalNodes: 3,
    totalFindings: 15,
    cooldown: [],
    nodes: [
      {
        reportId: "20260323_143015_a1b2c3d4_initial-profiling",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial-profiling",
        findings_count: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4e5f6_correlation-deep-dive",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep-dive",
        findings_count: 4,
        decisionScore: 0.82,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_144615_e5f6a7b8_distribution-analysis",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-144615-distribution-analysis",
        findings_count: 6,
        decisionScore: 0.75,
        startedAt: "2026-03-23T14:46:20.000Z",
        completedAt: "2026-03-23T14:53:45.000Z",
      },
    ],
  } satisfies AutopilotConfig,

  /** Session with circuit breaker cooldown entries */
  withCooldown: {
    $schema: "autopilot-config",
    status: "running",
    maxConcurrentTeammates: 3,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    totalNodes: 4,
    totalFindings: 11,
    cooldown: [
      {
        candidateId: "sentiment-analysis",
        consecutiveFailures: 3,
        lastFailedAt: "2026-03-23T15:10:00.000Z",
      },
      {
        candidateId: "external-api-enrichment",
        consecutiveFailures: 1,
        lastFailedAt: "2026-03-23T15:05:00.000Z",
      },
    ],
    nodes: [
      {
        reportId: "20260323_143015_a1b2c3d4_initial-profiling",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial-profiling",
        findings_count: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4e5f6_correlation-deep-dive",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep-dive",
        findings_count: 4,
        decisionScore: 0.82,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_145000_b1c2d3e4_sentiment-analysis",
        parentIds: ["20260323_143822_c3d4e5f6_correlation-deep-dive"],
        status: "failed",
        teamName: "autopilot-20260323-145000-sentiment-analysis",
        findings_count: 0,
        decisionScore: 0.65,
        startedAt: "2026-03-23T14:50:00.000Z",
        completedAt: null,
      },
      {
        reportId: "20260323_151000_d4e5f6a7_regional-patterns",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "completed",
        teamName: "autopilot-20260323-151000-regional-patterns",
        findings_count: 2,
        decisionScore: 0.71,
        startedAt: "2026-03-23T15:10:00.000Z",
        completedAt: "2026-03-23T15:18:30.000Z",
      },
    ],
  } satisfies AutopilotConfig,

  /** Session with a timed-out node */
  withTimeout: {
    $schema: "autopilot-config",
    status: "running",
    maxConcurrentTeammates: 3,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    totalNodes: 2,
    totalFindings: 5,
    cooldown: [],
    nodes: [
      {
        reportId: "20260323_143015_a1b2c3d4_initial-profiling",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial-profiling",
        findings_count: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143830_f8a9b0c1_large-scale-clustering",
        parentIds: ["20260323_143015_a1b2c3d4_initial-profiling"],
        status: "timeout",
        teamName: "autopilot-20260323-143830-large-scale-clustering",
        findings_count: 0,
        decisionScore: 0.88,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: null,
      },
    ],
  } satisfies AutopilotConfig,
} as const;

// ── State (control signal) fixtures ──────────────────────────────

export const autopilotStates = {
  /** Active autopilot — default running state */
  running: {
    command: "running",
    updatedAt: "2026-03-23T14:30:15.000Z",
    reason: null,
  } satisfies AutopilotState,

  /** User paused the session */
  paused: {
    command: "pause",
    updatedAt: "2026-03-23T14:46:20.000Z",
    reason: null,
  } satisfies AutopilotState,

  /** User aborted the session */
  aborted: {
    command: "abort",
    updatedAt: "2026-03-23T14:45:00.000Z",
    reason: "User requested abort",
  } satisfies AutopilotState,
} as const;

// ── Test scenarios ───────────────────────────────────────────────

export interface AutopilotScenario {
  /** Human-readable description */
  description: string;
  /** Initial config for this scenario */
  config: AutopilotConfig;
  /** Sequence of node findings (array index = expansion step) */
  nodeFindings: number[];
  /** Expected control signal commands during the scenario */
  controlSignals?: AutopilotState[];
  /** Whether a pause occurs (and at which node) */
  pauseAtNode?: number;
  /** Whether user aborts (and at which node) */
  abortAtNode?: number;
  /** Expected node statuses at end */
  expectedNodeStatuses?: Record<string, AutopilotNode["status"]>;
}

export const scenarios = {
  /** Infinite expansion — keeps expanding with steady findings */
  infiniteExpansion: {
    description:
      "Expands nodes indefinitely with steady findings, never stops on its own",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 6, 5, 3, 7, 4, 5],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
      "20260323_145345_a9b0c1d2_category-breakdown": "completed",
      "20260323_150030_b3c4d5e6_discount-impact": "completed",
    },
  } satisfies AutopilotScenario,

  /** Cross-branch combination — mixes insights from unrelated branches */
  crossBranchCombination: {
    description:
      "When single-branch candidates dry up, combines insights from different branches to find new angles",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 6, 1, 0, 8],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
      "20260323_145345_a9b0c1d2_category-breakdown": "completed",
      "20260323_150030_b3c4d5e6_cross-branch-synthesis": "completed",
    },
  } satisfies AutopilotScenario,

  /** Resume from existing — re-running /autopilot on a directory with nodes */
  resumeFromExisting: {
    description:
      "Re-running /autopilot on .otterwise/ with existing nodes; rebuilds DAG and continues expanding",
    config: autopilotConfigs.withExistingNodes,
    nodeFindings: [3, 5, 4],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
    },
  } satisfies AutopilotScenario,

  /** Resume from aborted — re-running after a previous abort */
  resumeFromAborted: {
    description:
      "Re-running /autopilot after abort; status resets to running, continues from existing nodes",
    config: autopilotConfigs.aborted,
    nodeFindings: [4, 6],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
    },
  } satisfies AutopilotScenario,

  /** Paused at node 2, then continues expanding after pause */
  userPause: {
    description:
      "User pauses after node 2, resumes, autopilot continues expanding indefinitely",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 3, 6],
    pauseAtNode: 2,
    controlSignals: [
      autopilotStates.running,
      autopilotStates.paused,
      autopilotStates.running,
    ],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
      "20260323_145345_a9b0c1d2_category-breakdown": "completed",
    },
  } satisfies AutopilotScenario,

  /** Aborted at node 3 with partial results */
  userAbort: {
    description:
      "User aborts mid-session at node 3; nodes preserved, status set to aborted",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 3],
    abortAtNode: 3,
    controlSignals: [autopilotStates.running, autopilotStates.aborted],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
    },
  } satisfies AutopilotScenario,

  /** Deep expansion with depth-first strategy */
  depthFirstExpansion: {
    description:
      "Depth-first strategy follows a single branch deeply before branching out",
    config: autopilotConfigs.deepAnalysis,
    nodeFindings: [5, 4, 3, 5, 6, 4],
    controlSignals: [autopilotStates.running],
  } satisfies AutopilotScenario,

  /** Pause state transitions: running → pause → running */
  pauseStateTransitions: {
    description:
      "Validates full pause lifecycle: running session pauses, waits, then resumes and continues expanding",
    config: autopilotConfigs.withExistingNodes,
    nodeFindings: [3, 5, 4, 6],
    pauseAtNode: 1,
    controlSignals: [
      autopilotStates.running,
      autopilotStates.paused,
      autopilotStates.running,
    ],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_144615_e5f6a7b8_distribution-analysis": "completed",
      "20260323_145400_c2d3e4f5_post-pause-expansion": "completed",
    },
  } satisfies AutopilotScenario,

  /** Circuit breaker — candidates in cooldown are skipped */
  circuitBreaker: {
    description:
      "Candidate with 3+ consecutive failures is in cooldown and skipped; next best candidate is selected instead",
    config: autopilotConfigs.withCooldown,
    nodeFindings: [2, 5, 3],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143822_c3d4e5f6_correlation-deep-dive": "completed",
      "20260323_145000_b1c2d3e4_sentiment-analysis": "failed",
      "20260323_151000_d4e5f6a7_regional-patterns": "completed",
    },
  } satisfies AutopilotScenario,

  /** Timeout — researcher does not complete within 30 minutes */
  researcherTimeout: {
    description:
      "Researcher exceeds 30-minute timeout; node marked as timeout, autopilot continues with available results",
    config: autopilotConfigs.withTimeout,
    nodeFindings: [5, 0, 4],
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2c3d4_initial-profiling": "completed",
      "20260323_143830_f8a9b0c1_large-scale-clustering": "timeout",
      "20260323_150900_a0b1c2d3_fallback-analysis": "completed",
    },
  } satisfies AutopilotScenario,
} as const;
