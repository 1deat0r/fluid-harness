import assert from 'node:assert/strict';

import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-option-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate } = fixture;

const pending = factory.proposeArchitectures({
  goal: 'leave the default proposal pass non-mutating',
  plannerCandidates: [plannerCandidate]
});
assert.equal(pending.archived, false);
assert.equal(pending.archive, null);
assert.equal(ledger.length, 0);

const beforeInvalid = ledger.serialize();
assert.throws(
  () => factory.proposeArchitectures({
    goal: 'reject a non-boolean archive option',
    plannerCandidates: [plannerCandidate],
    archive: 1
  }),
  /archive must be boolean/
);
const accessorOptions = {
  goal: 'reject an archive accessor',
  plannerCandidates: [plannerCandidate]
};
Object.defineProperty(accessorOptions, 'archive', {
  enumerable: true,
  get() {
    return true;
  }
});
assert.throws(
  () => factory.proposeArchitectures(accessorOptions),
  /only enumerable data properties/
);
assert.equal(ledger.serialize(), beforeInvalid);

const archived = factory.proposeArchitectures({
  goal: 'archive explicitly through the convenience option',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(archived.archived, true);
assert.equal(archived.archive.sequence, 1);
assert.equal(archived.dataOnly, true);
assert.equal(archived.authorityTransferred, false);
assert.equal(Object.isFrozen(archived), true);
assert.equal(Object.isFrozen(archived.proposals), true);
assert.equal(ledger.length, 1);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_OPTION_BOUNDARY_OK defaultPreserved=true `
  + `invalidOptionRejected=true accessorRejected=true archived=${archived.archived} `
  + `ledgerEntries=${ledger.length} dataOnly=${archived.dataOnly} authorityTransferred=${archived.authorityTransferred}`
);
