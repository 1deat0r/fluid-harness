import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { memoryFromLedger, MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement-rejection-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;
factory.manufacture({
  goal: 'create memory boundary evidence',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.throws(
  () => factory.improve({
    goal: 'record rejected evidence for memory boundaries',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    memoryQuery: { keywords: ['adopted'] }
  }),
  /did not strictly improve measured fitness/
);

const before = ledger.serialize();
const memory = memoryFromLedger({ ledger, idPrefix: 'rejection-memory-boundary' });
assert.throws(
  () => memory.query({ source: 'NOT_A_MEMORY_SOURCE' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
assert.throws(
  () => memory.query({
    sources: [
      MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION,
      MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION
    ]
  }),
  /unique/
);
assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 1 }),
  /exceeds remaining capacity/
);
const artifactResult = memory.query({
  source: MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION
}).results[0];
assert.equal(Object.hasOwn(artifactResult, 'candidate'), false);
assert.equal(Object.hasOwn(artifactResult, 'runner'), false);
assert.equal(Object.hasOwn(artifactResult, 'actionReport'), false);
assert.equal(Object.hasOwn(artifactResult, 'authorityTransferred'), false);
assert.equal(artifactResult.dataOnly, true);
assert.equal(artifactResult.historicalOnly, true);
assert.equal(Object.isFrozen(artifactResult), true);

const tampered = JSON.parse(before);
tampered.records[tampered.records.length - 1].payload.improvement.accepted = true;
assert.throws(
  () => memoryFromLedger({ ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered)) }),
  /hash verification failed|cannot be accepted|invalid/
);
assert.equal(ledger.serialize(), before);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_REJECTION_MEMORY_BOUNDARY_OK invalidSourceRejected=true `
  + `accessorRejected=true duplicateSourceRejected=true capacityRejected=true `
  + `artifactSuppressed=true tamperedRejected=true ledgerPreserved=true `
  + `historicalOnly=${artifactResult.historicalOnly} authoritySuppressed=${artifactResult.authorityTransferred === undefined}`
);
