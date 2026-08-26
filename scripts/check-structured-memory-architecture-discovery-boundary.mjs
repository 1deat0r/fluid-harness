import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  BoundedStructuredMemory,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const first = buildArchitectureDiscoveryReport({
  caseId: 'structured-memory-architecture-boundary-first-case',
  plannerId: 'structured-memory-architecture-boundary-first-planner',
  goal: 'archive the first architecture experiment'
});
const second = buildArchitectureDiscoveryReport({
  expected: () => false,
  caseId: 'structured-memory-architecture-boundary-second-case',
  plannerId: 'structured-memory-architecture-boundary-second-planner',
  goal: 'archive the second architecture experiment'
});
const ledger = new EvidenceLedger();
ledger.appendArchitectureDiscovery(first);
ledger.appendArchitectureDiscovery(second);
const restored = EvidenceLedger.fromSerialized(ledger.serialize());

assert.throws(
  () => memoryFromLedger({ ledger: {} }),
  /trusted evidence ledger/
);
assert.throws(
  () => new BoundedStructuredMemory({ maxEntries: 1 }).rememberLedger({ ledger: restored }),
  /exceeds remaining capacity/
);

const accessorOptions = { ledger: restored };
Object.defineProperty(accessorOptions, 'idPrefix', {
  enumerable: true,
  get() {
    return 'forged';
  }
});
assert.throws(
  () => memoryFromLedger(accessorOptions),
  /only enumerable data properties/
);

const tampered = JSON.parse(ledger.serialize());
tampered.records[0].payload.candidates[0].architectureFingerprint = 'forged';
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /inconsistent|fingerprint verification failed|hash verification failed/
);

const memory = memoryFromLedger({ ledger: restored });
assert.equal(memory.size, 2);
assert.throws(
  () => memory.query({ source: 'FORGED' }),
  /source is invalid/
);
assert.equal(memory.entries.every((entry) => entry.dataOnly && entry.historicalOnly), true);
assert.equal(memory.entries.every((entry) => entry.source === 'ARCHITECTURE_DISCOVERY'), true);
assert.equal(memory.entries.every((entry) => !Object.hasOwn(entry, 'authority')), true);

console.log(
  `FLUID_STRUCTURED_MEMORY_ARCHITECTURE_DISCOVERY_BOUNDARY_OK `
  + `forgedLedgerRejected=true capacityRejected=true accessorRejected=true `
  + `tamperedRejected=true sourceRejected=true dataOnly=true historicalOnly=true `
  + `authoritySuppressed=${MEMORY_SOURCES.ARCHITECTURE_DISCOVERY === 'ARCHITECTURE_DISCOVERY'}`
);
