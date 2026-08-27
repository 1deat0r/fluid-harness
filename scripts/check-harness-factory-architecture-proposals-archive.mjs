import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryArchitectureProposalReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets, discoveryRunner } = fixture;

const pending = factory.proposeArchitectures({
  goal: 'archive an untested architecture proposal',
  plannerCandidates: [plannerCandidate]
});
assert.equal(pending.archived, false);
assert.equal(pending.archive, null);
assert.equal(ledger.length, 0);

const archived = factory.archiveArchitectureProposals(pending);
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(archived), true);
assert.equal(archived.archived, true);
assert.equal(archived.archive.kind, 'harness-factory-architecture-proposals');
assert.equal(archived.archive.sequence, 1);
assert.equal(archived.evaluated, false);
assert.equal(archived.adopted, false);
assert.equal(archived.deployed, false);
assert.equal(archived.dataOnly, true);
assert.equal(archived.authorityTransferred, false);
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);

assert.throws(
  () => factory.archiveArchitectureProposals(pending),
  /already been archived/
);
assert.throws(
  () => factory.archiveArchitectureProposals(archived),
  /already been archived/
);

const history = factory.architectureProposalHistory();
assert.equal(history.consideredBatchCount, 1);
assert.equal(history.returnedBatchCount, 1);
assert.equal(history.truncated, false);
assert.equal(history.batches[0].archive.sequence, 1);
assert.equal(history.batches[0].proposalCount, 1);
assert.equal(history.batches[0].proposals[0].architectureFingerprint, pending.proposals[0].architectureFingerprint);
assert.equal(Object.hasOwn(history.batches[0], 'candidate'), false);
assert.equal(Object.hasOwn(history.batches[0].proposals[0], 'runner'), false);
assert.equal(Object.isFrozen(history.batches), true);
assert.equal(Object.isFrozen(history.batches[0].proposals[0].components), true);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restoredBatches = restoredLedger.restoreHarnessFactoryArchitectureProposals();
assert.equal(restoredBatches.length, 1);
assert.deepEqual(restoredBatches[0], history.batches[0]);
const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner,
  ledger: restoredLedger
});
assert.deepEqual(restoredFactory.architectureProposalHistory(), history);

const repeated = factory.proposeArchitectures({
  goal: 'avoid repeating the archived proposal',
  plannerCandidates: [plannerCandidate]
});
assert.equal(repeated.proposals[0].repeated, true);
assert.equal(repeated.proposals[0].novel, false);
assert.equal(repeated.proposals[0].historicalMatchCount, 1);
assert.equal(repeated.proposals[0].architectureFingerprint, pending.proposals[0].architectureFingerprint);
assert.equal(ledger.length, 1);

const explicitSecondArchive = factory.archiveArchitectureProposals(repeated);
assert.equal(explicitSecondArchive.archived, true);
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_OK archived=${archived.archived} `
  + `history=${history.returnedBatchCount} repeatedMatches=${repeated.proposals[0].historicalMatchCount} `
  + `ledgerEntries=${ledger.length} dataOnly=${archived.dataOnly} `
  + `authorityTransferred=${archived.authorityTransferred}`
);
