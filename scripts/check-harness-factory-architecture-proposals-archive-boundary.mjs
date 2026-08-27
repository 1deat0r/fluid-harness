import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate } = fixture;
const pending = factory.proposeArchitectures({
  goal: 'prepare one proposal for boundary checks',
  plannerCandidates: [plannerCandidate]
});
const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignPending = foreignFixture.factory.proposeArchitectures({
  goal: 'prepare a foreign proposal',
  plannerCandidates: [foreignFixture.plannerCandidate]
});

assert.throws(
  () => factory.archiveArchitectureProposals(Object.assign({}, pending)),
  /exact report from this factory/
);
assert.throws(
  () => factory.archiveArchitectureProposals(new Proxy(pending, {})),
  /exact report from this factory/
);
assert.throws(
  () => factory.archiveArchitectureProposals(foreignPending),
  /exact report from this factory/
);
assert.equal(ledger.length, 0);

const archived = factory.archiveArchitectureProposals(pending);
const afterArchive = ledger.serialize();
assert.equal(ledger.length, 1);
assert.throws(
  () => factory.archiveArchitectureProposals(pending),
  /already been archived/
);
assert.throws(
  () => factory.archiveArchitectureProposals(archived),
  /already been archived/
);
assert.equal(ledger.serialize(), afterArchive);

const tamperedCount = JSON.parse(afterArchive);
tamperedCount.records[0].payload.proposalCount = 2;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedCount)),
  /inconsistent|hash verification|invalid shape/
);

const tamperedArtifact = JSON.parse(afterArchive);
tamperedArtifact.records[0].payload.proposals[0].runner = {
  execute: 'must not cross the archive boundary'
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedArtifact)),
  /invalid|hash verification/
);

const restored = EvidenceLedger.fromSerialized(afterArchive)
  .restoreHarnessFactoryArchitectureProposals()[0];
assert.equal(Object.hasOwn(restored, 'candidate'), false);
assert.equal(Object.hasOwn(restored, 'runner'), false);
assert.equal(Object.hasOwn(restored, 'actionReport'), false);
assert.equal(Object.hasOwn(restored.proposals[0], 'candidate'), false);
assert.equal(Object.hasOwn(restored.proposals[0], 'runner'), false);
assert.equal(Object.hasOwn(restored.proposals[0], 'actionReport'), false);
assert.equal(restored.dataOnly, true);
assert.equal(restored.authorityTransferred, false);
assert.equal(ledger.serialize(), afterArchive);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_BOUNDARY_OK forgedRejected=true `
  + `proxyRejected=true foreignRejected=true reusedRejected=true tamperedRejected=true `
  + `artifactRejected=true ledgerPreserved=${ledger.verify()} authoritySuppressed=${archived.authorityTransferred === false}`
);
