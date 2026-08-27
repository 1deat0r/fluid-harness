import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-authority-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
const beforeLedger = ledger.serialize();

const proposal = factory.proposeArchitectures({
  goal: 'proposal-only authority boundary',
  plannerCandidates: [plannerCandidate]
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(proposal), true);
assert.equal(proposal.evaluated, false);
assert.equal(proposal.adopted, false);
assert.equal(proposal.deployed, false);
assert.equal(proposal.dataOnly, true);
assert.equal(proposal.authorityTransferred, false);
assert.equal(Object.hasOwn(proposal, 'candidate'), false);
assert.equal(Object.hasOwn(proposal, 'runner'), false);
assert.equal(Object.hasOwn(proposal, 'actionReport'), false);
assert.equal(Object.hasOwn(proposal.proposals[0], 'candidate'), false);
assert.equal(Object.hasOwn(proposal.proposals[0], 'runner'), false);
assert.equal(Object.hasOwn(proposal.proposals[0], 'actionReport'), false);
assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(factory.history().consideredGenerationCount, 0);
assert.equal(factory.architectureCoverage().consideredAttemptCount, 0);
assert.equal(factory.improvementRejections().consideredRejectionCount, 0);

const evaluated = factory.manufacture({
  goal: 'explicitly evaluate after proposal-only inspection',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(evaluated), true);
assert.equal(evaluated.status, 'ADOPTED');
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);
assert.equal(proposal.evaluated, false);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_AUTHORITY_BOUNDARY_OK `
  + `proposalLedgerEntries=0 explicitEvaluationStatus=${evaluated.status} `
  + `finalLedgerEntries=${ledger.length} proposalEvaluated=${proposal.evaluated} `
  + `authorityTransferred=${proposal.authorityTransferred}`
);
