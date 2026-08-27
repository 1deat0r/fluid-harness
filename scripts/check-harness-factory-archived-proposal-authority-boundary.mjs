import assert from 'node:assert/strict';

import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-archived-authority',
  includeResearch: false
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const source = factory.proposeArchitectures({
  goal: 'keep archived proposals data-only',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const report = factory.manufactureFromArchivedProposals(source, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});

assert.equal(Object.isFrozen(source), true);
assert.equal(source.evaluated, false);
assert.equal(source.adopted, false);
assert.equal(source.deployed, false);
assert.equal(source.dataOnly, true);
assert.equal(source.authorityTransferred, false);
assert.equal(report.dataOnly, true);
assert.equal(report.authorityTransferred, false);
assert.equal(report.deployed, false);
assert.equal(report.discovery, undefined);
assert.equal(report.status, 'ADOPTED');
assert.equal(report.factoryMetadata.dataOnly, true);
assert.equal(report.factoryMetadata.proposalArchive.sequence, source.archive.sequence);
assert.equal(report.proposalArchive.sequence, source.archive.sequence);
assert.equal(report.proposalArchive.kind, source.archive.kind);
assert.equal(report.proposalArchive.hash, source.archive.hash);

const restored = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(restored.length, 1);
assert.equal(restored[0].evaluated, false);
assert.equal(restored[0].adopted, false);
assert.equal(restored[0].deployed, false);
assert.equal(restored[0].dataOnly, true);
assert.equal(restored[0].authorityTransferred, false);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHIVED_PROPOSAL_AUTHORITY_BOUNDARY_OK `
  + `sourceEvaluated=${source.evaluated} sourceAdopted=${source.adopted} `
  + `sourceDataOnly=${source.dataOnly} sourceAuthorityTransferred=${source.authorityTransferred} `
  + `freshAdopted=${report.freshAdoption} freshDeployed=${report.deployed} `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
