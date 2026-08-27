import assert from 'node:assert/strict';

import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-archived-boundary',
  includeResearch: false
});
const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-archived-foreign',
  includeResearch: false
});
const {
  factory,
  ledger,
  plannerCandidate,
  evaluationCase,
  budgets
} = fixture;
const archived = factory.proposeArchitectures({
  goal: 'reject unsafe archived proposal inputs',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const pending = factory.proposeArchitectures({
  goal: 'reject a pending proposal report',
  plannerCandidates: [plannerCandidate]
});
const foreign = foreignFixture.factory.proposeArchitectures({
  goal: 'foreign archived proposal batch',
  plannerCandidates: [foreignFixture.plannerCandidate],
  archive: true
});
const stale = {
  ...archived,
  archive: {
    ...archived.archive,
    sequence: archived.archive.sequence + 100,
    hash: 'sha256:stale-archive'
  }
};
const tampered = {
  ...archived,
  proposals: archived.proposals.map((proposal, index) => index === 0
    ? { ...proposal, id: 'tampered-proposal-id' }
    : proposal)
};
const forged = { ...archived };
const validOptions = {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
};

function ledgerSnapshot() {
  return JSON.stringify(ledger.serialize());
}

function rejects(label, callback) {
  const before = ledgerSnapshot();
  assert.throws(callback, undefined, label);
  assert.equal(ledgerSnapshot(), before, `${label} mutated the ledger`);
}

rejects('forged report', () => {
  factory.manufactureFromArchivedProposals(forged, validOptions);
});
rejects('pending report', () => {
  factory.manufactureFromArchivedProposals(pending, validOptions);
});
rejects('foreign report', () => {
  factory.manufactureFromArchivedProposals(foreign, validOptions);
});
rejects('stale report', () => {
  factory.manufactureFromArchivedProposals(stale, validOptions);
});
rejects('tampered report', () => {
  factory.manufactureFromArchivedProposals(tampered, validOptions);
});
rejects('unknown planner candidate', () => {
  factory.manufactureFromArchivedProposals(archived, {
    ...validOptions,
    plannerCandidates: [foreignFixture.plannerCandidate]
  });
});
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'plannerCandidates', {
  enumerable: true,
  get: () => [plannerCandidate]
});
rejects('accessor-bearing options', () => {
  factory.manufactureFromArchivedProposals(archived, accessorOptions);
});
rejects('goal mismatch', () => {
  factory.manufactureFromArchivedProposals(archived, {
    ...validOptions,
    goal: 'a different goal'
  });
});
rejects('unknown option', () => {
  factory.manufactureFromArchivedProposals(archived, {
    ...validOptions,
    archive: false
  });
});
assert.equal(ledger.verify(), true);
assert.equal(ledger.length, 1);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHIVED_PROPOSAL_BOUNDARY_OK `
  + `forged=true pending=true foreign=true stale=true tampered=true `
  + `unknown=true accessor=true goalMismatch=true unknownOption=true `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
