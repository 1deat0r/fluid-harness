import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { MemoryAwareAgentSessionRunner } from '../src/memory-agent-session.mjs';
import {
  isTrustedMemoryAwareAgentSessionScalingCurve,
  isTrustedMemoryAwareAgentSessionScalingLevel,
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
  const plannerCandidate = new AgentPlannerCandidate({
    id: `memory-aware-scaling-planner-${level.id}`,
    description: 'A fresh deterministic process-isolated graph planner',
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphCoordination',
        timeoutMs: 2000
      }),
      plannerId: `memory-aware-scaling-planner-${level.id}-runtime`
    })
  });
  return {
    architectureGoal: `measure ${level.id} bounded memory-aware session`,
    agentGoal: 'graph',
    plannerCandidates: [plannerCandidate],
    cases: [new AgentPlannerCase({
      id: `memory-aware-scaling-case-${level.id}`,
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: `memory-aware-scaling-task-${level.id}`,
        description: 'Find a graph path'
      },
      task: {
        id: `memory-aware-scaling-task-${level.id}`,
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
      taskId: `memory-aware-scaling-task-${level.id}`,
      description: 'Find a graph path'
    },
    reproduction: `memory-aware-scaling-${level.id}`
  };
}

const levels = [
  new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scale-two-agents',
    computeUnits: 4,
    agentCount: 2,
    maxRounds: 2,
    minimumProvenAgents: 2
  }),
  new MemoryAwareAgentSessionScalingLevel({
    id: 'memory-aware-scale-three-agents',
    computeUnits: 6,
    agentCount: 3,
    maxRounds: 2,
    minimumProvenAgents: 3
  })
];
assert.equal(isTrustedMemoryAwareAgentSessionScalingLevel(levels[0]), true);
const curve = new MemoryAwareAgentSessionScalingRunner({
  sessionFactory: ({ level }) => buildSession(level),
  runOptionsFactory: ({ level }) => buildOptions(level)
}).evaluate({
  candidateId: 'memory-aware-session-scaling',
  levels
});

assert.equal(isTrustedMemoryAwareAgentSessionScalingCurve(curve), true);
assert.equal(Object.isFrozen(curve), true);
assert.equal(curve.points.length, 2);
assert.equal(curve.complete, true);
assert.equal(curve.dataOnly, true);
assert.equal(curve.points[0].agentCount, 2);
assert.equal(curve.points[1].agentCount, 3);
assert.equal(curve.points[0].maxRounds, 2);
assert.equal(curve.points[1].maxRounds, 2);
assert.equal(curve.points[0].finalQuorumMet, true);
assert.equal(curve.points[1].finalQuorumMet, true);
assert.equal(curve.points[0].allRoundsQuorumMet, true);
assert.equal(curve.points[1].allRoundsQuorumMet, true);
assert.equal(curve.points[0].persistenceComplete, true);
assert.equal(curve.points[1].persistenceComplete, true);
assert.equal(curve.points[0].persistedRuns, 4);
assert.equal(curve.points[1].persistedRuns, 6);
assert.equal(curve.points[0].expectedPersistedRuns, 4);
assert.equal(curve.points[1].expectedPersistedRuns, 6);
assert.equal(curve.points[0].provenRate, 1);
assert.equal(curve.points[1].provenRate, 1);
assert.equal(curve.points[0].successRate, 1);
assert.equal(curve.points[1].successRate, 1);
assert.equal(curve.points[0].deployed, false);
assert.equal(curve.points[1].constitutionalMutation, false);
assert.equal(curve.points[0].elapsedMs >= 0, true);
assert.equal(curve.points[1].elapsedMs >= 0, true);
assert.equal(curve.frontier.length, 1);
assert.equal(curve.frontier[0].levelId, 'memory-aware-scale-two-agents');
assert.equal(Object.hasOwn(curve.points[0], 'sessionReport'), false);
assert.equal(Object.hasOwn(curve.points[0], 'agents'), false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SCALING_OK levels=${curve.points.length} `
  + `complete=${curve.complete} agents=${curve.points.map(({ agentCount }) => agentCount).join(',')} `
  + `rounds=${curve.points.map(({ maxRounds }) => maxRounds).join(',')} `
  + `provenRates=${curve.points.map(({ provenRate }) => provenRate).join(',')} `
  + `persisted=${curve.points.map(({ persistedRuns }) => persistedRuns).join(',')} `
  + `frontier=${curve.frontier.map(({ levelId }) => levelId).join(',')} `
  + `deployment=false dataOnly=${curve.dataOnly}`
);
