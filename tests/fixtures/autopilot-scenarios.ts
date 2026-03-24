/**
 * Test scenarios for autopilot graph expansion, stopping conditions, and state transitions.
 *
 * Usage:
 *   import { scenarios, autopilotConfigs, autopilotStates } from "../fixtures/autopilot-scenarios.js";
 */

// ── AutopilotConfig type (graph-based expansion) ──

export interface AutopilotNode {
  reportId: string;
  parentId: string | null;
  status: "completed" | "in-progress" | "timeout" | "failed";
  teamName: string;
  findingsCount: number;
  decisionScore: number | null;
  stoppingReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AutopilotConfig {
  $schema?: string;
  maxIterations: number;
  maxConcurrentTeammates: number;
  stoppingThreshold: number;
  researchTimeoutMinutes: number;
  explorationStrategy: "balanced" | "breadth-first" | "depth-first";
  seedPhrase: string;
  customStoppingCriteria: string[];
  stopping: {
    minFindingsPerNode: number;
    maxDeadEndRatio: number;
  };
  scope: {
    focusAreas: string[] | null;
    excludeTopics: string[] | null;
    depthLimit: number;
  };
  notifications: {
    progressUpdates: string;
  };
  createdAt: string;
  completedAt: string | null;
  stoppingReason: string | null;
  totalNodes: number;
  totalFindings: number;
  nodes: AutopilotNode[];
}

// ── AutopilotState type (control signal file) ──

export interface AutopilotState {
  command: "running" | "pause" | "resume" | "abort";
  updatedAt: string;
  reason: string | null;
}

// ── Stopping reason enum ──

export type StoppingReason =
  | "max-iterations"
  | "diminishing-returns"
  | "goals-met"
  | "confidence-threshold"
  | "dead-end-saturation"
  | "no-new-questions"
  | "no-viable-candidates"
  | "time-budget"
  | "custom"
  | "user-abort";

// ── Config fixtures ──────────────────────────────────────────────

export const autopilotConfigs = {
  /** Fresh session — balanced defaults, no nodes yet */
  balanced: {
    $schema: "autopilot-config",
    maxIterations: 5,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: null,
    stoppingReason: null,
    totalNodes: 0,
    totalFindings: 0,
    nodes: [],
  } satisfies AutopilotConfig,

  /** Quick 2-iteration scan */
  quickScan: {
    $schema: "autopilot-config",
    maxIterations: 2,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 15,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-160000",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T16:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalNodes: 0,
    totalFindings: 0,
    nodes: [],
  } satisfies AutopilotConfig,

  /** Deep 10-iteration investigation with custom criteria */
  deepAnalysis: {
    $schema: "autopilot-config",
    maxIterations: 10,
    maxConcurrentTeammates: 5,
    stoppingThreshold: 0.90,
    researchTimeoutMinutes: 60,
    explorationStrategy: "depth-first",
    seedPhrase: "autopilot-20260323-170000",
    customStoppingCriteria: [
      "Stop if all anomaly types have been categorized",
    ],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T17:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalNodes: 0,
    totalFindings: 0,
    nodes: [],
  } satisfies AutopilotConfig,

  /** Single-iteration config (edge case) */
  singleIteration: {
    $schema: "autopilot-config",
    maxIterations: 1,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-180000",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T18:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalNodes: 0,
    totalFindings: 0,
    nodes: [],
  } satisfies AutopilotConfig,

  /** Completed session — 5 nodes expanded */
  completed: {
    $schema: "autopilot-config",
    maxIterations: 5,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: "2026-03-23T15:05:00.000Z",
    stoppingReason: "max-iterations",
    totalNodes: 5,
    totalFindings: 23,
    nodes: [
      {
        reportId: "20260323_143015_a1b2",
        parentId: null,
        status: "completed",
        teamName: "autopilot-20260323-143015-initial",
        findingsCount: 5,
        decisionScore: null,
        stoppingReason: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4",
        parentId: "20260323_143015_a1b2",
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep",
        findingsCount: 4,
        decisionScore: 0.82,
        stoppingReason: null,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
      },
      {
        reportId: "20260323_144615_e5f6",
        parentId: "20260323_143015_a1b2",
        status: "completed",
        teamName: "autopilot-20260323-144615-distribution",
        findingsCount: 6,
        decisionScore: 0.75,
        stoppingReason: null,
        startedAt: "2026-03-23T14:46:20.000Z",
        completedAt: "2026-03-23T14:53:45.000Z",
      },
      {
        reportId: "20260323_145345_g7h8",
        parentId: "20260323_143822_c3d4",
        status: "completed",
        teamName: "autopilot-20260323-145345-segmentation",
        findingsCount: 5,
        decisionScore: 0.71,
        stoppingReason: null,
        startedAt: "2026-03-23T14:53:50.000Z",
        completedAt: "2026-03-23T15:00:30.000Z",
      },
      {
        reportId: "20260323_150030_i9j0",
        parentId: "20260323_144615_e5f6",
        status: "completed",
        teamName: "autopilot-20260323-150030-temporal",
        findingsCount: 3,
        decisionScore: 0.58,
        stoppingReason: "max-iterations",
        startedAt: "2026-03-23T15:00:35.000Z",
        completedAt: "2026-03-23T15:05:00.000Z",
      },
    ],
  } satisfies AutopilotConfig,

  /** In-progress session — 2 nodes expanded */
  inProgress: {
    $schema: "autopilot-config",
    maxIterations: 5,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-143015",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerNode: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-node",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: null,
    stoppingReason: null,
    totalNodes: 2,
    totalFindings: 9,
    nodes: [
      {
        reportId: "20260323_143015_a1b2",
        parentId: null,
        status: "completed",
        teamName: "autopilot-20260323-143015-initial",
        findingsCount: 5,
        decisionScore: null,
        stoppingReason: null,
        startedAt: "2026-03-23T14:30:15.000Z",
        completedAt: "2026-03-23T14:38:22.000Z",
      },
      {
        reportId: "20260323_143822_c3d4",
        parentId: "20260323_143015_a1b2",
        status: "completed",
        teamName: "autopilot-20260323-143822-correlation-deep",
        findingsCount: 4,
        decisionScore: 0.82,
        stoppingReason: null,
        startedAt: "2026-03-23T14:38:30.000Z",
        completedAt: "2026-03-23T14:46:15.000Z",
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

  /** User resumed after pause */
  resumed: {
    command: "resume",
    updatedAt: "2026-03-23T14:50:00.000Z",
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
  /** Expected stopping reason from the enum */
  expectedStopReason: StoppingReason;
  /** Expected control signal commands during the scenario */
  controlSignals?: AutopilotState[];
  /** Whether a pause occurs (and at which node) */
  pauseAtNode?: number;
  /** Whether user resumes after pause */
  resumeAfterPause?: boolean;
  /** Whether user aborts (and at which node) */
  abortAtNode?: number;
  /** Expected node statuses at end */
  expectedNodeStatuses?: Record<string, AutopilotNode["status"]>;
}

export const scenarios = {
  /** 5 nodes expanded, normal stop at max iterations */
  normalCompletion: {
    description:
      "Expands 5 graph nodes to completion with steady findings, stops at max-iterations",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 6, 5, 3],
    expectedStopReason: "max-iterations",
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
      "20260323_150030_i9j0": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops at node 3 due to low findings (diminishing returns) */
  diminishingReturns: {
    description:
      "Findings drop steadily, autopilot stops early due to diminishing-returns",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 3, 1],
    expectedStopReason: "diminishing-returns",
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Paused at node 2, resumed, completed at node 4 */
  userPause: {
    description:
      "User pauses after node 2, resumes, autopilot completes at node 4 with diminishing-returns",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 3, 1],
    expectedStopReason: "diminishing-returns",
    pauseAtNode: 2,
    resumeAfterPause: true,
    controlSignals: [
      autopilotStates.running,
      autopilotStates.paused,
      autopilotStates.resumed,
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
      "User aborts mid-session at node 3; partial results preserved",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 4, 3],
    expectedStopReason: "user-abort",
    abortAtNode: 3,
    controlSignals: [autopilotStates.running, autopilotStates.aborted],
    expectedNodeStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops because dead-end ratio exceeds threshold */
  allDeadEnds: {
    description:
      "Over 50% of recent branches are dead-ends, autopilot stops with dead-end-saturation",
    config: autopilotConfigs.balanced,
    nodeFindings: [5, 0, 0],
    expectedStopReason: "dead-end-saturation",
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops after 1 node because maxIterations=1 */
  singleIteration: {
    description:
      "Single-iteration config; autopilot expands one node and stops at max-iterations",
    config: autopilotConfigs.singleIteration,
    nodeFindings: [8],
    expectedStopReason: "max-iterations",
    controlSignals: [autopilotStates.running],
    expectedNodeStatuses: {
      "20260323_180000_a1b2": "completed",
    },
  } satisfies AutopilotScenario,
} as const;
