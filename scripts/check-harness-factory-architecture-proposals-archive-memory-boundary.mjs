import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { MEMORY_SOURCES, memoryFromLedger } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDuplicateBatch'
});
const { factory, ledger, plannerCandidate } = fixture;

factory.proposeArchitectures({
  goal: 'create two proposal memory entries',
  plannerCandidates: [plannerCandidate],
  archive: true
});
const beforeLedger = ledger.serialize();

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'overflow proposal memory capacity',
    plannerCandidates: [plannerCandidate],
    memoryQuery: {
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
      keywords: ['proposal-untested']
    },
    maxMemoryEntries: 1
  }),
  /capacity/
);

const memory = memoryFromLedger({
  ledger: EvidenceLedger.fromSerialized(beforeLedger),
  maxEntries: 8,
  idPrefix: 'proposal-memory-boundary'
});
assert.throws(
  () => memory.query({ source: 'UNSUPPORTED_SOURCE' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
assert.throws(
  () => memory.query({
    sources: [
      MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
      MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL
    ]
  }),
  /unique|duplicate/
);
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(beforeLedger),
    maxEntries: 1,
    idPrefix: 'proposal-memory-overflow'
  }),
  /capacity/
);

const tampered = JSON.parse(beforeLedger);
tampered.records[0].payload.proposals[0].runner = {
  invoke: 'runtime artifact must not enter proposal memory'
};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /invalid|hash verification/
);

const memoryResults = memory.query({
  source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL
});
assert.equal(memoryResults.returnedCount, 2);
assert.equal(Object.hasOwn(memoryResults.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(memoryResults.results[0], 'runner'), false);
assert.equal(Object.hasOwn(memoryResults.results[0], 'actionReport'), false);
assert.equal(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_MEMORY_BOUNDARY_OK invalidSourceRejected=true `
  + `accessorRejected=true duplicateSourceRejected=true capacityRejected=true tamperedRejected=true `
  + `artifactSuppressed=true ledgerPreserved=${ledger.verify()} historicalOnly=${memoryResults.results[0].historicalOnly}`
);
