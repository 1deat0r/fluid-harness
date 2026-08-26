import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureCandidate
} from '../src/agent-architecture.mjs';
import {
  AgentArchitectureProposalRunner,
  isTrustedAgentArchitectureProposalReport,
  isTrustedAgentArchitectureProposal
} from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'proposal-registered-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'proposal-registered-planner-runtime'
  })
});
const proposalRunner = new AgentArchitectureProposalRunner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'proposeArchitectureDirect',
    timeoutMs: 2000
  }),
  maxProposals: 2
});
const proposalReport = proposalRunner.propose({
  goal: 'discover a bounded graph architecture',
  plannerCandidateIds: [plannerCandidate.id]
});

assert.equal(isTrustedAgentArchitectureProposalReport(proposalReport), true);
assert.equal(proposalReport.source, 'PROCESS_ISOLATED');
assert.equal(proposalReport.dataOnly, true);
assert.equal(Object.isFrozen(proposalReport.proposals), true);
assert.equal(proposalReport.proposals.length, 1);
assert.equal(isTrustedAgentArchitectureProposal(proposalReport.proposals[0]), true);
assert.equal(proposalReport.proposals[0].dataOnly, true);
assert.equal(Object.isFrozen(proposalReport.proposals[0].components), true);

const resolved = proposalRunner.resolve({
  report: proposalReport,
  plannerCandidates: [plannerCandidate]
});
assert.equal(resolved.length, 1);
assert.equal(isTrustedAgentArchitectureCandidate(resolved[0]), true);
assert.equal(resolved[0].id, 'process-architecture-direct');
assert.equal(Object.isFrozen(resolved[0].components), true);

const cases = [
  new AgentPlannerCase({
    id: 'proposal-architecture-case',
    domain: 'graph',
    goal: 'graph',
    context: { taskId: 'proposal-architecture-task', description: 'Find a graph path' },
    task: { id: 'proposal-architecture-task', description: 'Find a graph path' },
    adversarial: true,
    expected: (report) => report?.completed === true
      && report.cycles[0].action.evidence === EVIDENCE_LEVELS.PROVEN
  })
];
const searchReport = new AgentArchitectureSearchRunner().evaluate({
  candidates: resolved,
  cases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(searchReport.complete, true);
assert.equal(searchReport.promoted, null);
assert.equal(searchReport.winner.architectureId, 'process-architecture-direct');
assert.equal(searchReport.winner.plannerReport.results[0].production.results[0].proven, true);

console.log(
  `FLUID_AGENT_ARCHITECTURE_PROPOSAL_OK proposals=${proposalReport.proposals.length} `
  + `resolved=${resolved.length} source=${proposalReport.source} `
  + `parentProof=${searchReport.winner.plannerReport.results[0].production.results[0].proven ? 'PROVEN' : 'NONE'} `
  + `promoted=${searchReport.promoted ?? 'none'}`
);
