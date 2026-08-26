import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentArchitectureSessionRunner } from '../src/agent-architecture-session.mjs';
import {
  AgentArchitectureSessionScalingCurve,
  AgentArchitectureSessionScalingLevel,
  AgentArchitectureSessionScalingRunner,
  agentArchitectureSessionScalingFrontier,
  isTrustedAgentArchitectureSessionScalingCurve,
  isTrustedAgentArchitectureSessionScalingLevel
} from '../src/agent-architecture-scaling.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function buildSession(level) {
  return new AgentArchitectureSessionRunner({
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
  const plannerCandidate = new AgentPlannerCandidate({
    id: `architecture-scaling-boundary-planner-${level.id}`,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: `architecture-scaling-boundary-planner-${level.id}-runtime`
    })
  });
  return {
    architectureGoal: `measure ${level.id} bounded architecture`,
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: `architecture-scaling-boundary-case-${level.id}`,
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: `architecture-scaling-boundary-task-${level.id}`,
        description: 'Find a graph path'
      },
      task: {
        id: `architecture-scaling-boundary-task-${level.id}`,
        description: 'Find a graph path'
      },
      adversarial: true,
      expected: (report) => report?.completed === true
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    context: {
      taskId: `architecture-scaling-boundary-task-${level.id}`,
      description: 'Find a graph path'
    }
  };
}

const levelTwo = new AgentArchitectureSessionScalingLevel({
  id: 'scaling-boundary-two',
  computeUnits: 4,
  agentCount: 2,
  maxRounds: 2,
  minimumProvenAgents: 2
});
const levelThree = new AgentArchitectureSessionScalingLevel({
  id: 'scaling-boundary-three',
  computeUnits: 6,
  agentCount: 3,
  maxRounds: 2,
  minimumProvenAgents: 3
});
const validRunner = new AgentArchitectureSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: ({ level }) => buildOptions(level)
});
const validCurve = validRunner.evaluate({ levels: [levelTwo, levelThree] });
assert.equal(isTrustedAgentArchitectureSessionScalingCurve(validCurve), true);
assert.equal(isTrustedAgentArchitectureSessionScalingLevel(levelTwo), true);

assert.throws(
  () => new AgentArchitectureSessionScalingLevel({
    id: 'scaling-boundary-one-agent',
    computeUnits: 1,
    agentCount: 1,
    maxRounds: 1
  }),
  /at least 2/
);
assert.throws(
  () => new AgentArchitectureSessionScalingLevel({
    id: 'scaling-boundary-bad-quorum',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 3
  }),
  /cannot exceed/
);
assert.throws(
  () => new AgentArchitectureSessionScalingLevel({
    id: 'scaling-boundary-bad-rounds',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 0
  }),
  /positive safe integer/
);
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: null,
    runOptionsFactory: () => ({})
  }),
  /sessionFactory must be a function/
);
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: () => buildSession(levelTwo),
    runOptionsFactory: null
  }),
  /runOptionsFactory must be a function/
);

const sharedSession = buildSession(levelTwo);
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: () => sharedSession,
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelTwo, new AgentArchitectureSessionScalingLevel({
    id: 'scaling-boundary-shared-second',
    computeUnits: 5,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  })] }),
  /fresh session per level/
);
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: () => buildSession(levelTwo),
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelThree] }),
  /does not match session limits/
);
const forgedSession = Object.create(Object.getPrototypeOf(sharedSession));
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: () => forgedSession,
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelTwo] }),
  /trusted session/
);
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: ({ level }) => buildSession(level),
    runOptionsFactory: () => []
  }).evaluate({ levels: [levelTwo] }),
  /plain object/
);
const cyclicRunner = new AgentArchitectureSessionScalingRunner({
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
assert.throws(
  () => new AgentArchitectureSessionScalingRunner({
    sessionFactory: ({ level }) => buildSession(level),
    runOptionsFactory: ({ level }) => buildOptions(level)
  }).evaluate({ levels: [levelTwo, levelTwo] }),
  /computeUnits must be unique|level ids must be unique/
);
const forgedPoint = Object.create(Object.getPrototypeOf(validCurve.points[0]));
assert.throws(
  () => agentArchitectureSessionScalingFrontier([forgedPoint]),
  /trusted points/
);
assert.throws(
  () => new AgentArchitectureSessionScalingCurve({
    candidateId: 'forged-curve',
    points: [forgedPoint]
  }),
  /trusted/
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_SCALING_BOUNDARY_OK invalidConfigRejected=true `
  + `sharedSessionRejected=true mismatchedLevelRejected=true forgedRejected=true `
  + `cyclicRejected=true duplicateRejected=true dataOnly=${validCurve.dataOnly} `
  + `deployment=false`
);
