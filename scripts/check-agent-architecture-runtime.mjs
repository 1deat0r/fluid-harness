import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureDiscoveryRunner
} from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-runtime-registered-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-runtime-planner'
  })
});
const discoveryRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  })
});
const evaluationCase = new AgentPlannerCase({
  id: 'architecture-runtime-graph-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'architecture-runtime-graph-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'architecture-runtime-graph-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
});
const discovery = discoveryRunner.discover({
  goal: 'build one bounded architecture agent',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(discovery.adopted, true);

const agent = agentFromAdoptedArchitecture(discovery.adoption.adoption);
assert.equal(isTrustedAgentArchitectureAgent(agent), true);
assert.equal(agent.deployed, false);
assert.equal(agent.policy.maxEpisodes > 0, true);
const plan = agent.plan({
  goal: evaluationCase.goal,
  context: evaluationCase.context
});
assert.equal(plan.plannerId, 'architecture-runtime-planner');
const runReport = agent.run({
  goal: evaluationCase.goal,
  context: evaluationCase.context,
  reproduction: 'architecture-runtime-proof'
});
assert.equal(runReport.completed, true);
assert.equal(runReport.cycles.length, 1);
assert.equal(runReport.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(runReport.plannerId, 'architecture-runtime-planner');
assert.equal(runReport.auditValid, true);

console.log(
  `FLUID_AGENT_ARCHITECTURE_RUNTIME_OK architecture=${agent.architectureId} `
  + `trusted=true completed=${runReport.completed} proof=${runReport.cycles[0].action.evidence} `
  + `audit=${runReport.auditValid} deployed=${agent.deployed}`
);
