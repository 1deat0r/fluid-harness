import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildMemoryAwareCoordinationLedger } from './fixtures/memory-aware-coordination-ledger.mjs';

const { ledger, verifiedLedger } = buildMemoryAwareCoordinationLedger({
  prefix: 'structured-memory-coordination-boundary'
});

assert.throws(
  () => memoryFromLedger({ ledger: {}, maxEntries: 8 }),
  /trusted evidence ledger/
);
assert.throws(
  () => memoryFromLedger({ ledger: verifiedLedger, maxEntries: 5 }),
  /exceeds remaining capacity/
);
const memory = memoryFromLedger({ ledger: verifiedLedger });
assert.throws(
  () => memory.query({ source: 'FORGED' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.COORDINATION;
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
const tampered = JSON.parse(ledger.serialize());
tampered.records[tampered.records.length - 1].payload.finalQuorumMet = false;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /inconsistent|hash verification failed|fingerprint verification failed/
);
const coordination = memory.query({ source: MEMORY_SOURCES.COORDINATION });
assert.equal(coordination.totalMatches, 1);
assert.equal(coordination.dataOnly, true);
assert.equal(coordination.historicalOnly, true);
assert.equal(coordination.results[0].authority, undefined);
assert.equal(Object.hasOwn(coordination.results[0], 'rounds'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_COORDINATION_BOUNDARY_OK forgedLedgerRejected=true `
  + `capacityRejected=true invalidSourceRejected=true accessorRejected=true `
  + `tamperedRejected=true source=${coordination.results[0].source} dataOnly=${coordination.dataOnly} `
  + `historicalOnly=${coordination.historicalOnly} authoritySuppressed=`
  + `${Object.hasOwn(coordination.results[0], 'rounds') === false}`
);
