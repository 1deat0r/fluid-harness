import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { MemoryAwareAgentSessionRunner } from '../src/memory-agent-session.mjs';
import {
  isTrustedMemoryAwareAgentSessionScalingCurve,
  MemoryAwareAgentSessionScalingLevel,
  MemoryAwareAgentSessionScalingRunner
} from '../src/memory-agent-scaling.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const level = new MemoryAwareAgentSessionScalingLevel({
  id: 'memory-aware-scale-non-quorum',
  computeUnits: 6,
  agentCount: 3,
  maxRounds: 2,
  minimumProvenAgents: 3
});

const session = new MemoryAwareAgentSessionRunner({
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
const plannerCandidate = new AgentPlannerCandidate({
  id: 'memory-aware-scale-non-quorum-planner-candidate',
  description: 'A deterministic planner with one controlled member failure',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphCoordinationWithOneFailure',
      timeoutMs: 2000
    }),
    plannerId: 'memory-aware-scale-non-quorum-planner'
  })
});
const taskId = 'scale-non-quorum-task';
const options = {
  architectureGoal: 'measure non-quorum memory-aware session',
  agentGoal: 'graph',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'memory-aware-scale-non-quorum-case',
    domain: 'graph',
    goal: 'graph',
    context: { taskId, description: 'Find a graph path' },
    task: { id: taskId, description: 'Find a graph path' },
    adversarial: true,
    expected: (report) => report?.completed === true
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 }),
  ledger: new EvidenceLedger(),
  query: { keywords: ['graph-algorithms'], limit: 3 },
  context: { taskId, description: 'Find a graph path' },
  reproduction: 'memory-aware-scaling-non-quorum'
};

const curve = new MemoryAwareAgentSessionScalingRunner({
  sessionFactory: () => session,
  runOptionsFactory: () => options
}).evaluate({
  candidateId: 'memory-aware-session-scaling-non-quorum',
  levels: [level]
});

assert.equal(isTrustedMemoryAwareAgentSessionScalingCurve(curve), true);
assert.equal(Object.isFrozen(curve), true);
assert.equal(curve.complete, false);
assert.equal(curve.dataOnly, true);
assert.equal(curve.points.length, 1);
const point = curve.points[0];
assert.equal(point.agentCount, 3);
assert.equal(point.maxRounds, 2);
assert.equal(point.minimumProvenAgents, 3);
assert.equal(point.completedAgents, 2);
assert.equal(point.provenAgents, 2);
assert.equal(point.completedRounds, 2);
assert.equal(point.provenRounds, 0);
assert.equal(point.allRoundsComplete, false);
assert.equal(point.finalQuorumMet, false);
assert.equal(point.allRoundsQuorumMet, false);
assert.equal(point.persistenceComplete, false);
assert.equal(point.persistedRuns, 4);
assert.equal(point.expectedPersistedRuns, 6);
assert.equal(point.successRate, 0);
assert.equal(point.provenRate, 0);
assert.equal(point.complete, false);
assert.equal(point.elapsedMs >= 0, true);
assert.equal(point.deployed, false);
assert.equal(point.constitutionalMutation, false);
assert.equal(Object.hasOwn(point, 'sessionReport'), false);
assert.equal(Object.hasOwn(point, 'agents'), false);
assert.equal(curve.frontier.length, 1);
assert.equal(curve.frontier[0].levelId, level.id);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_SCALING_NON_QUORUM_OK levels=${curve.points.length} `
  + `complete=${curve.complete} agents=${point.completedAgents}/${point.agentCount} `
  + `proven=${point.provenAgents} quorum=${point.minimumProvenAgents} `
  + `rounds=${point.completedRounds} provenRounds=${point.provenRounds} `
  + `persisted=${point.persistedRuns}/${point.expectedPersistedRuns} `
  + `successRate=${point.successRate} provenRate=${point.provenRate} `
  + `proof=NOT_PROVEN deployment=false dataOnly=${curve.dataOnly}`
);
