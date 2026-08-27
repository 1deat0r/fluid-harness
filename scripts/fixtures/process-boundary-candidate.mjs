import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export function echo(input) {
  return {
    input,
    childPid: process.pid,
    parentPid: Number(process.env.FLUID_PARENT_PID ?? -1)
  };
}

export function toolEcho(input) {
  return {
    tool: 'echo',
    input,
    childPid: process.pid,
    parentPid: Number(process.env.FLUID_PARENT_PID ?? -1)
  };
}

export function toolGraphInput(input) {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B',
    source: input?.source ?? 'tool'
  };
}

export function planGraph({ goal, context }) {
  const callId = context?.callId ?? 'planner-tool-call';
  return {
    episodes: [{
      task: {
        id: `planned-${goal}`,
        description: 'Find a graph path'
      },
      input: null,
      toolCalls: [{
        toolId: 'planner-graph-tool',
        callId,
        input: { source: 'process-planner' }
      }],
      inputFromToolCall: callId
    }]
  };
}

export function planGraphDirect({ goal, context }) {
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `direct-${goal}`,
        description: context?.description ?? 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B',
        source: 'process-planner-direct'
      }
    }]
  };
}

export function planGraphFirstCase({ goal, context }) {
  const taskId = context?.taskId ?? `first-case-${goal}`;
  const firstCase = !taskId.includes('-second-');
  return {
    episodes: [{
      task: {
        id: taskId,
        description: context?.description ?? 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: firstCase ? [['A', 'B']] : [],
        start: 'A',
        goal: 'B',
        source: 'process-planner-first-case'
      }
    }]
  };
}

export function planGraphFromMemory({ goal, context }) {
  const memory = context?.memory ?? {};
  const resultCount = memory.resultCount ?? -1;
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `memory-${goal}`,
        description: `Find a graph path with ${resultCount} historical matches`
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B',
        source: 'process-planner-memory'
      }
    }]
  };
}

export function planGraphFromDistributionShiftMemory({ goal, context }) {
  const memory = context?.memory ?? {};
  const resultCount = memory.resultCount ?? -1;
  const firstResult = Array.isArray(memory.results) ? memory.results[0] : null;
  const keywords = Array.isArray(firstResult?.keywords) ? firstResult.keywords : [];
  const status = keywords.includes('weakness-exposed')
    ? 'weakness-exposed'
    : keywords.includes('robust')
      ? 'robust'
      : 'unclassified';
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `distribution-shift-memory-${goal}`,
        description: `Find a graph path after ${status} distribution-shift evidence with ${resultCount} historical matches`
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B',
        source: 'process-planner-distribution-shift-memory'
      }
    }]
  };
}

export function planGraphFromMemoryWithTool({ goal, context }) {
  const callId = context?.callId ?? 'memory-planner-tool-call';
  const resultCount = context?.memory?.resultCount ?? -1;
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `memory-tool-${goal}`,
        description: `Find a graph path with ${resultCount} historical matches`
      },
      input: null,
      toolCalls: [{
        toolId: 'memory-aware-tool',
        callId,
        input: { source: 'process-planner-memory-tool' }
      }],
      inputFromToolCall: callId
    }]
  };
}

export function planGraphFromMemoryNoPath({ goal, context }) {
  const resultCount = context?.memory?.resultCount ?? -1;
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `memory-no-path-${goal}`,
        description: `Find a graph path with ${resultCount} historical matches`
      },
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B',
        source: 'process-planner-memory-no-path'
      }
    }]
  };
}

export function planTwoGraphPathsFromMemory({ goal, context }) {
  const resultCount = context?.memory?.resultCount ?? -1;
  const prefix = context?.taskId ?? `memory-two-${goal}`;
  return {
    episodes: [
      {
        task: {
          id: `${prefix}-first`,
          description: `Find a graph path with ${resultCount} historical matches`
        },
        input: {
          nodes: ['A', 'B'],
          edges: [],
          start: 'A',
          goal: 'B',
          source: 'process-planner-memory-two-first'
        }
      },
      {
        task: {
          id: `${prefix}-second`,
          description: `Find a graph path with ${resultCount} historical matches`
        },
        input: {
          nodes: ['A', 'B'],
          edges: [],
          start: 'A',
          goal: 'B',
          source: 'process-planner-memory-two-second'
        }
      }
    ]
  };
}

export function planGraphCoordination({ goal, context }) {
  return {
    episodes: [{
      task: {
        id: context?.taskId ?? `coordination-${goal}`,
        description: context?.description ?? 'Find a graph path'
      },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B',
        source: 'process-planner-coordination',
        coordinationRound: context?.coordination?.round ?? 0,
        peerEvidenceCount: context?.coordination?.peerEvidence?.length ?? 0
      }
    }]
  };
}

export function planGraphCoordinationWithOneFailure({ goal, context }) {
  if (context?.memoryAwareEnsemble?.memberIndex === 1) {
    return {
      episodes: [{
        task: {
          id: context?.taskId ?? `coordination-failure-${goal}`
        },
        input: null
      }]
    };
  }
  return planGraphCoordination({ goal, context });
}

export function planMissingDescription() {
  return {
    episodes: [{
      task: { id: 'invalid-planned-task' },
      input: null
    }]
  };
}

export function planMany() {
  return {
    episodes: [
      { task: { id: 'planned-a', description: 'Find a graph path' }, input: null },
      { task: { id: 'planned-b', description: 'Find a graph path' }, input: null },
      { task: { id: 'planned-c', description: 'Find a graph path' }, input: null }
    ]
  };
}

export function proposeArchitectureDirect({ plannerCandidateIds }) {
  return {
    proposals: [{
      id: 'process-architecture-direct',
      plannerCandidateId: plannerCandidateIds[0],
      policy: {
        maxEpisodes: 2,
        maxToolCallsPerEpisode: 2
      },
      components: {
        planner: 'registered-process-planner',
        policy: 'bounded-v1',
        verifier: 'parent-core'
      }
    }]
  };
}

export function proposeArchitectureDuplicateBatch({ plannerCandidateIds }) {
  const shared = {
    plannerCandidateId: plannerCandidateIds[0],
    policy: {
      maxEpisodes: 2
    },
    components: {
      planner: 'registered-process-planner',
      policy: 'bounded-v1',
      verifier: 'parent-core'
    }
  };
  return {
    proposals: [
      { ...shared, id: 'process-architecture-duplicate-a' },
      { ...shared, id: 'process-architecture-duplicate-b' }
    ]
  };
}

export function proposeArchitectureFromResearch({ plannerCandidateIds, researchContext }) {
  const firstResult = Array.isArray(researchContext?.results)
    ? researchContext.results[0]
    : null;
  const keywords = Array.isArray(firstResult?.keywords) ? firstResult.keywords : [];
  const researchSignal = keywords.includes('weakness-exposed')
    ? 'weakness-exposed'
    : keywords.includes('robust')
      ? 'robust'
      : 'none';
  const resultCount = researchContext?.resultCount ?? 0;
  return {
    proposals: [{
      id: 'research-informed-architecture',
      plannerCandidateId: plannerCandidateIds[0],
      policy: {
        maxEpisodes: 2,
        maxToolCallsPerEpisode: 2
      },
      components: {
        researchSource: researchContext?.source ?? 'NONE',
        researchSignal,
        researchResultCount: resultCount,
        response: researchSignal === 'weakness-exposed'
          ? 'robustness-review'
          : 'baseline-review'
      }
    }]
  };
}

export function proposeArchitectureFromFactoryArchive({ plannerCandidateIds, researchContext }) {
  const firstResult = Array.isArray(researchContext?.results)
    ? researchContext.results[0]
    : null;
  const keywords = Array.isArray(firstResult?.keywords) ? firstResult.keywords : [];
  const priorOutcome = keywords.includes('adopted')
    ? 'adopted'
    : keywords.includes('rejected')
      ? 'rejected'
      : 'none';
  const priorHoldoutStatus = keywords.includes('holdout-passed')
    ? 'passed'
    : keywords.includes('holdout-failed')
      ? 'failed'
      : keywords.includes('holdout-not-run')
        ? 'not-run'
        : 'unknown';
  const candidateIndex = priorOutcome === 'rejected' && plannerCandidateIds.length > 1
    ? 1
    : 0;
  return {
    proposals: [{
      id: 'factory-improvement-architecture',
      plannerCandidateId: plannerCandidateIds[candidateIndex],
      policy: {
        maxEpisodes: 2,
        maxToolCallsPerEpisode: 2
      },
      components: {
        improvement: 'archive-informed',
        priorHoldoutStatus,
        priorFactoryOutcome: priorOutcome,
        priorFactoryResultCount: researchContext?.resultCount ?? 0,
        researchSource: researchContext?.source ?? 'NONE'
      }
    }]
  };
}

export function proposeArchitectureFromBenchmarkValidationMemory({
  plannerCandidateIds,
  researchContext
}) {
  const firstResult = Array.isArray(researchContext?.results)
    ? researchContext.results[0]
    : null;
  const keywords = Array.isArray(firstResult?.keywords) ? firstResult.keywords : [];
  const validationStatus = keywords.includes('validation-failed')
    ? 'failed'
    : keywords.includes('validation-passed')
      ? 'passed'
      : 'unknown';
  const candidateIndex = validationStatus === 'failed' && plannerCandidateIds.length > 1
    ? 1
    : 0;
  return {
    proposals: [{
      id: 'benchmark-validation-informed-architecture',
      plannerCandidateId: plannerCandidateIds[candidateIndex],
      policy: {
        maxEpisodes: 2,
        maxToolCallsPerEpisode: 2
      },
      components: {
        improvement: 'benchmark-validation-informed',
        priorValidationStatus: validationStatus,
        priorValidationResultCount: researchContext?.resultCount ?? 0,
        researchSource: researchContext?.source ?? 'NONE'
      }
    }]
  };
}

export function proposeArchitectureUnknown({ plannerCandidateIds }) {
  return {
    proposals: [{
      id: 'process-architecture-unknown',
      plannerCandidateId: `${plannerCandidateIds[0]}-unknown`,
      policy: {
        maxEpisodes: 2,
        maxToolCallsPerEpisode: 2
      },
      components: {
        planner: 'unregistered'
      }
    }]
  };
}

export function proposeArchitectureMany({ plannerCandidateIds }) {
  return {
    proposals: [
      {
        id: 'process-architecture-many-a',
        plannerCandidateId: plannerCandidateIds[0],
        policy: { maxEpisodes: 2 },
        components: { variant: 'a' }
      },
      {
        id: 'process-architecture-many-b',
        plannerCandidateId: plannerCandidateIds[0],
        policy: { maxEpisodes: 2 },
        components: { variant: 'b' }
      },
      {
        id: 'process-architecture-many-c',
        plannerCandidateId: plannerCandidateIds[0],
        policy: { maxEpisodes: 2 },
        components: { variant: 'c' }
      }
    ]
  };
}

export function proposeArchitectureMalformed({ plannerCandidateIds }) {
  return {
    proposals: [{
      id: 'process-architecture-malformed',
      plannerCandidateId: plannerCandidateIds[0],
      policy: {
        maxEpisodes: 'two'
      },
      components: {
        malformed: true
      }
    }]
  };
}

export function proposeArchitectureExtraKey({ plannerCandidateIds }) {
  return {
    proposals: [{
      id: 'process-architecture-extra-key',
      plannerCandidateId: plannerCandidateIds[0],
      policy: { maxEpisodes: 2 },
      components: { variant: 'extra-key' },
      unexpected: true
    }]
  };
}

export function toolFail() {
  throw new Error('tool fixture failed');
}

export function toolHuge() {
  return 'x'.repeat(16 * 1024);
}

export function selectGraph() {
  return 'graph';
}

export function executeGraph({ input }) {
  const found = input.start === 'A' && input.goal === 'B';
  return {
    status: found ? 'success' : 'failure',
    observation: found ? 'graph path resolved' : 'graph path not found',
    deterministic: true,
    result: {
      found,
      path: found ? ['A', 'B'] : null,
      distance: found ? 1 : null,
      searchComplete: true,
      expansions: 2,
      expansionBudget: null
    }
  };
}

export function executeWrongGraph() {
  return {
    status: 'success',
    observation: 'graph path resolved',
    deterministic: true,
    result: {
      found: true,
      path: ['A', 'A'],
      distance: 1,
      searchComplete: true,
      expansions: 1,
      expansionBudget: null
    }
  };
}

export async function capabilityReport() {
  const report = {};
  try {
    readFileSync('/etc/passwd', 'utf8');
    report.filesystem = 'allowed';
  } catch (error) {
    report.filesystem = error.code ?? error.name;
  }
  try {
    spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
    report.childProcess = 'allowed';
  } catch (error) {
    report.childProcess = error.code ?? error.name;
  }
  try {
    await fetch('http://127.0.0.1:9');
    report.network = 'allowed';
  } catch (error) {
    report.network = error.code ?? error.name;
  }
  return report;
}

export function hang() {
  return new Promise(() => {
    setInterval(() => {}, 1000);
  });
}

export function crash() {
  process.exit(23);
}

export function huge() {
  return 'x'.repeat(16 * 1024);
}
