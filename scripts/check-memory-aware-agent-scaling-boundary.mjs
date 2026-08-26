import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { MemoryAwareAgentSessionRunner } from '../src/memory-agent-session.mjs';
import {
  isTrustedMemoryAwareAgentSessionScalingCurve,
  memoryAwareAgentSessionScalingFrontier,
  MemoryAwareAgentSessionScalingCurve,
  MemoryAwareAgentSessionScalingLevel,
  MemoryAwareAgentSessionScalingRunner
} from '../src/memory-agent-scaling.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildSession(level) {
  return new MemoryAwareAgentSessionRunner({
    proposalRunner: new AgentArchitectureProposalRunner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'proposeArchitectureDirect',
        timeoutMs: 2000
      })
    }),
    agentCount: level.agentCount,
    maxRounds: level.maxRounds,
    minimumProvenAgents: level.minimumProvenAgents
  });
}

function buildOptions(level) {
  const taskId = `scale-${level.id}`;
  const plannerCandidate = new AgentPlannerCandidate({
    id: `memory-aware-scaling-boundary-planner-${level.id}`,
    description: 'A fresh deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: `memory-aware-scaling-boundary-planner-${level.id}-runtime`
    })
  });
  return {
    architectureGoal: `measure ${level.id} bounded memory-aware session`,
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: `memory-aware-scaling-boundary-case-${level.id}`,
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId,
        description: 'Find a graph path'
      },
      task: {
        id: taskId,
        description: 'Find a graph path'
      },
      adversarial: true,
      expected: (report) => report?.completed === true
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    ledger: new EvidenceLedger(),
    query: { keywords: ['graph-algorithms'], limit: 3 },
    context: {
      taskId,
      description: 'Find a graph path'
    }
  };
}

const levelTwo = new MemoryAwareAgentSessionScalingLevel({
  id: 'memory-aware-scaling-boundary-two',
  computeUnits: 4,
  agentCount: 2,
  maxRounds: 2,
  minimumProvenAgents: 2
});
const levelThree = new MemoryAwareAgentSessionScalingLevel({
  id: 'memory-aware-scaling-boundary-three',
  computeUnits: 6,
  agentCount: 3,
  maxRounds: 2,
  minimumProvenAgents: 3
});
const validRunner = new MemoryAwareAgentSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: ({ level }) => buildOptions(level)
});
const validCurve = validRunner.evaluate({ levels: [levelTwo, levelThree] });
assert.equal(isTrustedMemoryAwareAgentSessionScalingCurve(validCurve), true);

assert.throws(
  () => new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scaling-boundary-one-agent',
    computeUnits: 1,
    agentCount: 1,
    maxRounds: 1
  }),
  /at least 2/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scaling-boundary-five-agents',
    computeUnits: 5,
    agentCount: 5,
    maxRounds: 1
  }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scaling-boundary-five-rounds',
    computeUnits: 5,
    agentCount: 2,
    maxRounds: 5
  }),
  /cannot exceed 4/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scaling-boundary-bad-quorum',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 3
  }),
  /cannot exceed/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scaling-boundary-bad-rounds',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 0
  }),
  /positive safe integer/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: null,
    runOptionsFactory: () => ({})
  }),
  /sessionFactory must be a function/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: () => buildSession(levelTwo),
    runOptionsFactory: null
  }),
  /runOptionsFactory must be a function/
);

const sharedSession = buildSession(levelTwo);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: () => sharedSession,
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({
    levels: [levelTwo, new MemoryAwareAgentSessionScalingLevel({
      id: 'memory-aware-scaling-boundary-shared-second',
      computeUnits: 5,
      agentCount: 2,
      maxRounds: 2,
      minimumProvenAgents: 2
    })]
  }),
  /fresh session per level/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: () => buildSession(levelTwo),
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelThree] }),
  /does not match session limits/
);
const forgedSession = Object.create(Object.getPrototypeOf(sharedSession));
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: () => forgedSession,
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelTwo] }),
  /trusted session/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: ({ level }) => buildSession(level),
    runOptionsFactory: () => []
  }).evaluate({ levels: [levelTwo] }),
  /plain object/
);
const accessorOptionsRunner = new MemoryAwareAgentSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: () => Object.defineProperty({}, 'ledger', {
    enumerable: true,
    get: () => new EvidenceLedger()
  })
});
assert.throws(
  () => accessorOptionsRunner.evaluate({ levels: [levelTwo] }),
  /enumerable data properties/
);
const cyclicRunner = new MemoryAwareAgentSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: ({ level }) => {
    const options = buildOptions(level);
    options.context.self = options.context;
    return options;
  }
});
assert.throws(
  () => cyclicRunner.evaluate({ levels: [levelTwo] }),
  /cycle|JSON-compatible/
);
const sharedLedger = new EvidenceLedger();
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: ({ level }) => buildSession(level),
    runOptionsFactory: ({ level }) => {
      const options = buildOptions(level);
      options.ledger = sharedLedger;
      return options;
    }
  }).evaluate({ levels: [levelTwo, levelThree] }),
  /fresh ledger per level/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingRunner({
    sessionFactory: ({ level }) => buildSession(level),
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({
    levels: [levelTwo, new MemoryAwareAgentSessionScalingLevel({
      id: 'memory-aware-scaling-boundary-duplicate-compute',
      computeUnits: 4,
      agentCount: 3,
      maxRounds: 2,
      minimumProvenAgents: 3
    })]
  }),
  /computeUnits must be unique/
);
const forgedPoint = Object.create(Object.getPrototypeOf(validCurve.points[0]));
assert.throws(
  () => memoryAwareAgentSessionScalingFrontier([forgedPoint]),
  /trusted points/
);
assert.throws(
  () => new MemoryAwareAgentSessionScalingCurve({
    candidateId: 'memory-aware-scaling-forged-curve',
    points: [forgedPoint]
  }),
  /trusted/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SCALING_BOUNDARY_OK invalidConfigRejected=true `
  + `sharedSessionRejected=true mismatchedLevelRejected=true forgedRejected=true `
  + `accessorRejected=true cyclicRejected=true sharedLedgerRejected=true duplicateRejected=true `
  + `dataOnly=${validCurve.dataOnly} deployment=false`
);
