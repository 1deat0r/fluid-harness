import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentArchitectureSessionRunner } from '../src/agent-architecture-session.mjs';
import {
  AgentArchitectureSessionScalingLevel,
  AgentArchitectureSessionScalingRunner,
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
    id: `architecture-scaling-planner-${level.id}`,
    description: 'A fresh deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: `architecture-scaling-planner-${level.id}-runtime`
    })
  });
  return {
    architectureGoal: `measure ${level.id} bounded architecture`,
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: `architecture-scaling-case-${level.id}`,
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: `architecture-scaling-task-${level.id}`,
        description: 'Find a graph path'
      },
      task: {
        id: `architecture-scaling-task-${level.id}`,
        description: 'Find a graph path'
      },
      adversarial: true,
      expected: (report) => report?.completed === true
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 }),
    context: {
      taskId: `architecture-scaling-task-${level.id}`,
      description: 'Find a graph path'
    },
    reproduction: `architecture-scaling-${level.id}`
  };
}

const levels = [
  new AgentArchitectureSessionScalingLevel({
    id: 'session-scale-two-agents',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  }),
  new AgentArchitectureSessionScalingLevel({
    id: 'session-scale-three-agents',
    computeUnits: 6,
    agentCount: 3,
    maxRounds: 2,
    minimumProvenAgents: 3
  })
];
assert.equal(isTrustedAgentArchitectureSessionScalingLevel(levels[0]), true);
const curve = new AgentArchitectureSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: ({ level }) => buildOptions(level)
}).evaluate({
  candidateId: 'architecture-session-scaling',
  levels
});

assert.equal(isTrustedAgentArchitectureSessionScalingCurve(curve), true);
assert.equal(curve.points.length, 2);
assert.equal(curve.complete, true);
assert.equal(curve.dataOnly, true);
assert.equal(curve.points[0].agentCount, 2);
assert.equal(curve.points[1].agentCount, 3);
assert.equal(curve.points[0].finalQuorumMet, true);
assert.equal(curve.points[1].finalQuorumMet, true);
assert.equal(curve.points[0].provenRate, 1);
assert.equal(curve.points[1].provenRate, 1);
assert.equal(curve.points[0].deployed, false);
assert.equal(curve.points[1].constitutionalMutation, false);
assert.equal(curve.frontier.length, 1);
assert.equal(curve.frontier[0].levelId, 'session-scale-two-agents');
assert.equal('agents' in curve.points[0], false);
assert.equal('sessionReport' in curve.points[0], false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_SCALING_OK levels=${curve.points.length} `
  + `complete=${curve.complete} lowAgents=${curve.points[0].agentCount} `
  + `highAgents=${curve.points[1].agentCount} provenRates=${curve.points.map(({ provenRate }) => provenRate).join(',')} `
  + `frontier=${curve.frontier.map(({ levelId }) => levelId).join(',')} `
  + `deployment=false dataOnly=${curve.dataOnly}`
);
