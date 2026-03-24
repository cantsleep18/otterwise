/**
 * Test scenarios for auto pilot loop control, stopping conditions, and state transitions.
 *
 * Usage:
 *   import { scenarios, autopilotConfigs, autopilotStates } from "../fixtures/autopilot-scenarios.js";
 */

// ── AutopilotConfig type (mirrors AUTOPILOT_IMPL_SPEC.md Section 4) ──

export interface AutopilotRound {
  number: number;
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
    minFindingsPerRound: number;
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
  totalRounds: number;
  totalFindings: number;
  rounds: AutopilotRound[];
}

// ── AutopilotState type (control signal file, AUTOPILOT_IMPL_SPEC.md Section 4) ──

export interface AutopilotState {
  command: "running" | "pause" | "resume" | "abort";
  updatedAt: string;
  reason: string | null;
}

// ── Stopping reason enum (AUTOPILOT_IMPL_SPEC.md Section 4) ──

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
  /** Fresh session — balanced defaults, no rounds yet */
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
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: null,
    stoppingReason: null,
    totalRounds: 0,
    totalFindings: 0,
    rounds: [],
  } satisfies AutopilotConfig,

  /** Quick 2-round scan */
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
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T16:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalRounds: 0,
    totalFindings: 0,
    rounds: [],
  } satisfies AutopilotConfig,

  /** Deep 10-round investigation with custom criteria */
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
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T17:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalRounds: 0,
    totalFindings: 0,
    rounds: [],
  } satisfies AutopilotConfig,

  /** Single-round config (edge case) */
  singleRound: {
    $schema: "autopilot-config",
    maxIterations: 1,
    maxConcurrentTeammates: 3,
    stoppingThreshold: 0.85,
    researchTimeoutMinutes: 30,
    explorationStrategy: "balanced",
    seedPhrase: "autopilot-20260323-180000",
    customStoppingCriteria: [],
    stopping: {
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T18:00:00.000Z",
    completedAt: null,
    stoppingReason: null,
    totalRounds: 0,
    totalFindings: 0,
    rounds: [],
  } satisfies AutopilotConfig,

  /** Completed session — 5 rounds finished */
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
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: "2026-03-23T15:05:00.000Z",
    stoppingReason: "max-iterations",
    totalRounds: 5,
    totalFindings: 23,
    rounds: [
      {
        number: 1,
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
        number: 2,
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
        number: 3,
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
        number: 4,
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
        number: 5,
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

  /** In-progress session — 2 rounds done */
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
      minFindingsPerRound: 2,
      maxDeadEndRatio: 0.6,
    },
    scope: {
      focusAreas: null,
      excludeTopics: null,
      depthLimit: 4,
    },
    notifications: {
      progressUpdates: "per-round",
    },
    createdAt: "2026-03-23T14:30:15.000Z",
    completedAt: null,
    stoppingReason: null,
    totalRounds: 2,
    totalFindings: 9,
    rounds: [
      {
        number: 1,
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
        number: 2,
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
  /** Sequence of round findings (array index = round number - 1) */
  roundFindings: number[];
  /** Expected stopping reason from the enum */
  expectedStopReason: StoppingReason;
  /** Expected control signal commands during the scenario */
  controlSignals?: AutopilotState[];
  /** Whether a pause occurs (and at which round) */
  pauseAtRound?: number;
  /** Whether user resumes after pause */
  resumeAfterPause?: boolean;
  /** Whether user aborts (and at which round) */
  abortAtRound?: number;
  /** Expected round statuses at end */
  expectedRoundStatuses?: Record<string, AutopilotRound["status"]>;
}

export const scenarios = {
  /** 5 rounds, normal stop at max iterations */
  normalCompletion: {
    description:
      "Runs all 5 rounds to completion with steady findings, stops at max-iterations",
    config: autopilotConfigs.balanced,
    roundFindings: [5, 4, 6, 5, 3],
    expectedStopReason: "max-iterations",
    controlSignals: [autopilotStates.running],
    expectedRoundStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
      "20260323_150030_i9j0": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops at round 3 due to low findings (diminishing returns) */
  diminishingReturns: {
    description:
      "Findings drop steadily, auto pilot stops early due to diminishing-returns",
    config: autopilotConfigs.balanced,
    roundFindings: [5, 3, 1],
    expectedStopReason: "diminishing-returns",
    controlSignals: [autopilotStates.running],
    expectedRoundStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Paused at round 2, resumed, completed at round 4 */
  userPause: {
    description:
      "User pauses after round 2, resumes, auto pilot completes at round 4 with diminishing-returns",
    config: autopilotConfigs.balanced,
    roundFindings: [5, 4, 3, 1],
    expectedStopReason: "diminishing-returns",
    pauseAtRound: 2,
    resumeAfterPause: true,
    controlSignals: [
      autopilotStates.running,
      autopilotStates.paused,
      autopilotStates.resumed,
    ],
    expectedRoundStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
      "20260323_145345_g7h8": "completed",
    },
  } satisfies AutopilotScenario,

  /** Aborted at round 3 with partial results */
  userAbort: {
    description:
      "User aborts mid-session at round 3; partial results preserved",
    config: autopilotConfigs.balanced,
    roundFindings: [5, 4, 3],
    expectedStopReason: "user-abort",
    abortAtRound: 3,
    controlSignals: [autopilotStates.running, autopilotStates.aborted],
    expectedRoundStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops because dead-end ratio exceeds threshold */
  allDeadEnds: {
    description:
      "Over 50% of recent branches are dead-ends, auto pilot stops with dead-end-saturation",
    config: autopilotConfigs.balanced,
    roundFindings: [5, 0, 0],
    expectedStopReason: "dead-end-saturation",
    controlSignals: [autopilotStates.running],
    expectedRoundStatuses: {
      "20260323_143015_a1b2": "completed",
      "20260323_143822_c3d4": "completed",
      "20260323_144615_e5f6": "completed",
    },
  } satisfies AutopilotScenario,

  /** Stops after round 1 because maxIterations=1 */
  singleRound: {
    description:
      "Single-round config; auto pilot runs one round and stops at max-iterations",
    config: autopilotConfigs.singleRound,
    roundFindings: [8],
    expectedStopReason: "max-iterations",
    controlSignals: [autopilotStates.running],
    expectedRoundStatuses: {
      "20260323_180000_a1b2": "completed",
    },
  } satisfies AutopilotScenario,
} as const;
