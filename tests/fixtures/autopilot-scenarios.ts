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
  findingsCount: number;
  decisionScore: number | null;
  startedAt: string;
  completedAt: string | null;
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
    nodes: [
      {
        reportId: "20260323_143015_a1b2",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial",
        findingsCount: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4",
        parentIds: ["20260323_143015_a1b2"],
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep",
        findingsCount: 4,
        decisionScore: 0.82,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_144615_e5f6",
        parentIds: ["20260323_143015_a1b2"],
        status: "completed",
        teamName: "autopilot-20260323-144615-distribution",
        findingsCount: 6,
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
    nodes: [
      {
        reportId: "20260323_143015_a1b2",
        parentIds: [],
        status: "completed",
        teamName: "autopilot-20260323-143015-initial",
        findingsCount: 5,
        decisionScore: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4",
        parentIds: ["20260323_143015_a1b2"],
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep",
        findingsCount: 4,
        decisionScore: 0.82,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_144615_e5f6",
        parentIds: ["20260323_143015_a1b2"],
        status: "completed",
        teamName: "autopilot-20260323-144615-distribution",
        findingsCount: 6,
        decisionScore: 0.75,
        startedAt: "2026-03-23T14:46:20.000Z",
        completedAt: "2026-03-23T14:53:45.000Z",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
      "20260323_150030_i9j0": "completed",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
      "20260323_150030_i9j0": "completed",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
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
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
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
} as const;
