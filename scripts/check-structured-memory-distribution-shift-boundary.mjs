import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  BoundedStructuredMemory,
  MEMORY_SOURCES,
  StructuredMemoryEntry,
  memoryFromLedger
} from '../src/memory.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'distribution-shift-memory-boundary'
});
const ledger = new EvidenceLedger();
ledger.appendDistributionShift(report);

assert.throws(
  () => memoryFromLedger({ ledger: {}, maxEntries: 8 }),
  /trusted evidence ledger/
);
assert.throws(
  () => memoryFromLedger({ ledger, maxEntries: 0 }),
  /maxEntries must be a positive integer/
);

const accessorQueryMemory = memoryFromLedger({
  ledger,
  idPrefix: 'distribution-shift-memory-accessor',
  maxEntries: 8
});
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    throw new Error('source accessor should not be read');
  }
});
assert.throws(
  () => accessorQueryMemory.query(accessorQuery),
  /only enumerable data properties/
);
assert.throws(
  () => accessorQueryMemory.query({ source: 'NOT_A_MEMORY_SOURCE' }),
  /source is invalid/
);

const mismatch = accessorQueryMemory.query({
  source: MEMORY_SOURCES.COORDINATION,
  strategyKey: 'distribution-shift',
  limit: 4
});
assert.equal(mismatch.totalMatches, 0);
assert.equal(mismatch.returnedCount, 0);

const occupiedEntry = new StructuredMemoryEntry({
  id: 'occupied-memory-entry',
  taskId: 'occupied-memory-task',
  description: 'Occupied memory slot',
  strategyKey: 'test',
  evidence: 'OBSERVED',
  surpriseBand: 'LOW',
  surpriseNats: 0,
  predictionError: false,
  source: MEMORY_SOURCES.CALLER,
  keywords: []
});
const fullMemory = new BoundedStructuredMemory({
  entries: [occupiedEntry],
  maxEntries: 1
});
assert.throws(
  () => fullMemory.rememberLedger({ ledger, idPrefix: 'distribution-shift-full' }),
  /exceeds remaining capacity/
);

const serialized = JSON.parse(ledger.serialize());
const tampered = structuredClone(serialized);
tampered.records[0].payload.shiftSuccesses = 0;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
    maxEntries: 8
  }),
  /hash verification failed|inconsistent/
);

const plainMemory = Object.create(Object.getPrototypeOf(accessorQueryMemory));
Object.assign(plainMemory, accessorQueryMemory);
assert.throws(
  () => plainMemory.query({ source: MEMORY_SOURCES.DISTRIBUTION_SHIFT }),
  /exact trusted memory/
);

const validMemory = memoryFromLedger({
  ledger,
  idPrefix: 'distribution-shift-memory-artifact',
  maxEntries: 8
});
const result = validMemory.query({ source: MEMORY_SOURCES.DISTRIBUTION_SHIFT, limit: 4 }).results[0];
assert.equal(Object.hasOwn(result, 'runner'), false);
assert.equal(Object.hasOwn(result, 'harness'), false);
assert.equal(Object.hasOwn(result, 'actionReport'), false);
assert.equal(Object.hasOwn(result, 'shiftCases'), false);
assert.equal(Object.hasOwn(result, 'promotionAuthority'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_DISTRIBUTION_SHIFT_BOUNDARY_OK forgedLedgerRejected=true `
  + `capacityRejected=true invalidSourceRejected=true accessorRejected=true `
  + `sourceMismatch=${mismatch.totalMatches} tamperedRejected=true `
  + `artifactExposureRejected=true source=${MEMORY_SOURCES.DISTRIBUTION_SHIFT} `
  + `dataOnly=true historicalOnly=true authoritySuppressed=true`
);
