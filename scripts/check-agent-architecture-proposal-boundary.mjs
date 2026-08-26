import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureProposalRunner,
  isTrustedAgentArchitectureProposalReport
} from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const plannerCandidate = new AgentPlannerCandidate({
  id: 'proposal-boundary-registered-planner',
  plannerFactory: () => new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphDirect',
      timeoutMs: 2000
    }),
    plannerId: 'proposal-boundary-planner-runtime'
  })
});

function proposer(exportName, maxProposals = 2) {
  return new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: 2000
    }),
    maxProposals
  });
}

const unknownRunner = proposer('proposeArchitectureUnknown');
const unknownReport = unknownRunner.propose({
  goal: 'unknown architecture',
  plannerCandidateIds: [plannerCandidate.id]
});
assert.equal(isTrustedAgentArchitectureProposalReport(unknownReport), true);
assert.throws(
  () => unknownRunner.resolve({
    report: unknownReport,
    plannerCandidates: [plannerCandidate]
  }),
  /unknown planner candidate/
);

assert.throws(
  () => proposer('proposeArchitectureMany', 2).propose({
    goal: 'too many architectures',
    plannerCandidateIds: [plannerCandidate.id]
  }),
  /maximum is 2/
);

const malformedRunner = proposer('proposeArchitectureMalformed');
const malformedReport = malformedRunner.propose({
  goal: 'malformed architecture',
  plannerCandidateIds: [plannerCandidate.id]
});
assert.throws(
  () => malformedRunner.resolve({
    report: malformedReport,
    plannerCandidates: [plannerCandidate]
  }),
  /safe integer/
);

assert.throws(
  () => proposer('proposeArchitectureExtraKey').propose({
    goal: 'extra proposal key',
    plannerCandidateIds: [plannerCandidate.id]
  }),
  /unsupported property/
);

assert.throws(
  () => proposer('proposeArchitectureDirect').propose({
    goal: 'duplicate registry ids',
    plannerCandidateIds: [plannerCandidate.id, plannerCandidate.id]
  }),
  /must be unique/
);

const validRunner = proposer('proposeArchitectureDirect');
const validReport = validRunner.propose({
  goal: 'forged report',
  plannerCandidateIds: [plannerCandidate.id]
});
assert.throws(
  () => validRunner.resolve({
    report: Object.create(Object.getPrototypeOf(validReport)),
    plannerCandidates: [plannerCandidate]
  }),
  /trusted proposal report/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(validRunner)).propose({
    goal: 'forged runner',
    plannerCandidateIds: [plannerCandidate.id]
  }),
  /exact trusted runner/
);
assert.throws(
  () => validRunner.resolve({
    report: validReport,
    plannerCandidates: [Object.create(Object.getPrototypeOf(plannerCandidate))]
  }),
  /trusted planner candidates/
);

console.log(
  `FLUID_AGENT_ARCHITECTURE_PROPOSAL_BOUNDARY_OK unknownRejected=true `
  + `oversizedRejected=true malformedRejected=true duplicateRejected=true `
  + `forgedRejected=true authorityBoundary=true`
);
