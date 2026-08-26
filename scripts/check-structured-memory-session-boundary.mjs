import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildMemoryAwareSessionLedger } from './fixtures/memory-aware-session-ledger.mjs';

const { ledger, verifiedLedger } = buildMemoryAwareSessionLedger({
  prefix: 'structured-memory-session-boundary'
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
    return MEMORY_SOURCES.SESSION;
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
const sessions = memory.query({ source: MEMORY_SOURCES.SESSION });
assert.equal(sessions.totalMatches, 1);
assert.equal(sessions.dataOnly, true);
assert.equal(sessions.historicalOnly, true);
assert.equal(sessions.results[0].authority, undefined);
assert.equal(Object.hasOwn(sessions.results[0], 'runner'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_SESSION_BOUNDARY_OK forgedLedgerRejected=true `
  + `capacityRejected=true invalidSourceRejected=true accessorRejected=true `
  + `tamperedRejected=true source=${sessions.results[0].source} dataOnly=${sessions.dataOnly} `
  + `historicalOnly=${sessions.historicalOnly} authoritySuppressed=`
  + `${Object.hasOwn(sessions.results[0], 'runner') === false}`
);
