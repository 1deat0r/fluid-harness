import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-archived-manufacture',
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
  goal: 'manufacture from an archived architecture proposal batch',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(archived), true);
assert.equal(archived.archived, true);
assert.equal(archived.archive.kind, 'harness-factory-architecture-proposals');
assert.equal(archived.evaluated, false);
assert.equal(archived.adopted, false);
assert.equal(archived.deployed, false);
assert.equal(archived.dataOnly, true);
assert.equal(archived.authorityTransferred, false);
assert.equal(ledger.length, 1);

const report = factory.manufactureFromArchivedProposals(archived, {
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(report), true);
assert.equal(report.status, 'ADOPTED');
assert.equal(report.complete, true);
assert.equal(report.reproducible, true);
assert.equal(report.freshAdoption, true);
assert.deepEqual(report.proposalArchive, archived.archive);
assert.deepEqual(report.factoryMetadata.proposalArchive, archived.archive);
assert.equal(report.generation, 1);
assert.equal(report.archive.sequence, 2);
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);

const restoredDiscoveries = ledger.restoreArchitectureDiscoveries();
assert.equal(restoredDiscoveries.length, 1);
assert.deepEqual(
  restoredDiscoveries[0].factory.proposalArchive,
  archived.archive
);
const history = factory.history();
assert.equal(history.generations.length, 1);
assert.deepEqual(history.generations[0].proposalArchive, archived.archive);
const restoredProposals = ledger.restoreHarnessFactoryArchitectureProposals();
assert.equal(restoredProposals.length, 1);
assert.equal(restoredProposals[0].evaluated, false);
assert.equal(restoredProposals[0].adopted, false);
assert.equal(restoredProposals[0].deployed, false);
assert.equal(restoredProposals[0].dataOnly, true);
assert.equal(restoredProposals[0].authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHIVED_PROPOSAL_MANUFACTURE_OK `
  + `sourceArchive=${archived.archive.sequence} generation=${report.generation} `
  + `generationArchive=${report.archive.sequence} proposalArchive=${report.proposalArchive.sequence} `
  + `status=${report.status} ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
