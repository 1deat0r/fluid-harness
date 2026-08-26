import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AgentArchitectureDiscoveryRunner } from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import {
  AgentArchitectureEnsembleRunner,
  isTrustedAgentArchitectureEnsembleReport
} from '../src/agent-architecture-ensemble.mjs';
import { agentFromAdoptedArchitecture } from '../src/agent-architecture-runtime.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-ensemble-registered-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-ensemble-planner'
  })
});
const discovery = new AgentArchitectureDiscoveryRunner({
  proposalRunner: new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'proposeArchitectureDirect',
      timeoutMs: 2000
    })
  })
}).discover({
  goal: 'build independent bounded agents',
  plannerCandidates: [plannerCandidate],
  cases: [new AgentPlannerCase({
    id: 'architecture-ensemble-case',
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: 'architecture-ensemble-task',
      description: 'Find a graph path'
    },
    task: {
      id: 'architecture-ensemble-task',
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: (report) => report?.completed === true
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
const first = agentFromAdoptedArchitecture(discovery.adoption.adoption);
const second = agentFromAdoptedArchitecture(discovery.adoption.adoption);
const report = new AgentArchitectureEnsembleRunner({
  maxAgents: 2,
  minimumProvenAgents: 2
}).run({
  agents: [first, second],
  goal: 'graph',
  context: {
    taskId: 'architecture-ensemble-task',
    description: 'Find a graph path'
  },
  reproduction: 'architecture-ensemble-proof'
});

assert.equal(isTrustedAgentArchitectureEnsembleReport(report), true);
assert.equal(report.attemptedAgents, 2);
assert.equal(report.completedAgents, 2);
assert.equal(report.provenAgents, 2);
assert.equal(report.quorum, 2);
assert.equal(report.quorumMet, true);
assert.equal(report.allComplete, true);
assert.equal(report.allProven, true);
assert.equal(report.auditValid, true);
assert.notEqual(first.planner, second.planner);
assert.notEqual(first.runner, second.runner);
assert.equal(report.deployed, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_ENSEMBLE_OK agents=${report.attemptedAgents} `
  + `completed=${report.completedAgents} proven=${report.provenAgents} `
  + `quorum=${report.quorum} quorumMet=${report.quorumMet} independent=true deployment=false`
);
