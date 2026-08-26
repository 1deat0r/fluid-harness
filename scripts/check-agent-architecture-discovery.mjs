import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCandidate,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureCandidate
} from '../src/agent-architecture.mjs';
import {
  AgentArchitectureDiscoveryRunner,
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

const plannerCandidate = new AgentPlannerCandidate({
  id: 'architecture-discovery-registered-planner',
  description: 'A deterministic process-isolated graph planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'architecture-discovery-registered-planner-runtime'
  })
});
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureMany',
    timeoutMs: 2000
  }),
  maxProposals: 3
});
const discoveryRunner = new AgentArchitectureDiscoveryRunner({ proposalRunner });
const evaluationCase = new AgentPlannerCase({
  id: 'architecture-discovery-graph-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'architecture-discovery-graph-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'architecture-discovery-graph-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
});

const report = discoveryRunner.discover({
  goal: 'discover and safely adopt a bounded graph architecture',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(isTrustedAgentArchitectureDiscoveryReport(report), true);
assert.equal(report.complete, true);
assert.equal(report.proposals.length, 3);
assert.equal(report.candidates.length, 3);
assert.equal(report.proposals[0].dataOnly, true);
assert.notEqual(report.candidates[0].plannerCandidate, report.candidates[1].plannerCandidate);
assert.notEqual(report.candidates[1].plannerCandidate, report.candidates[2].plannerCandidate);
assert.equal(report.primary.complete, true);
assert.equal(report.reproduction.complete, true);
assert.equal(report.reproducibility.reproducible, true);
assert.equal(report.adopted, true);
assert.equal(isTrustedAgentArchitectureCandidate(report.adoptedCandidate), true);
assert.notEqual(report.adoptedCandidate, report.candidates[0]);
assert.equal(report.deployed, false);
assert.equal(report.primary.promoted, null);
assert.equal(report.reproduction.promoted, null);

const adoptedReport = new AgentArchitectureSearchRunner().evaluate({
  candidates: [report.adoptedCandidate],
  cases: [evaluationCase],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(adoptedReport.complete, true);
assert.equal(adoptedReport.winner.plannerReport.results[0].production.results[0].proven, true);

console.log(
  `FLUID_AGENT_ARCHITECTURE_DISCOVERY_OK proposals=${report.proposals.length} `
  + `resolved=${report.candidates.length} replay=${report.reproducibility.reproducible} `
  + `adopted=${report.adopted} fresh=true `
  + `proof=${adoptedReport.winner.plannerReport.results[0].production.results[0].proven ? 'PROVEN' : 'NONE'} `
  + `deployed=${report.deployed}`
);
