import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedStructuredMemoryEntry,
  memoryFromLedger,
  MEMORY_SOURCES,
  StructuredMemoryEntry
} from '../src/memory.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';
import { buildResearchMemoryLedger } from './fixtures/research-memory-ledger.mjs';

function buildEntry(provenance) {
  return new StructuredMemoryEntry({
    id: 'structured-memory-provenance-boundary-entry',
    taskId: 'structured-memory-provenance-boundary-task',
    description: 'Boundary test memory entry',
    strategyKey: 'boundary-test',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    source: MEMORY_SOURCES.CALLER,
    keywords: ['boundary'],
    provenance
  });
}

const validProvenance = {
  hash: 'sha256:boundary',
  kind: 'core',
  sequence: 1
};
assert.equal(Object.isFrozen(buildEntry(validProvenance).provenance), true);
assert.throws(
  () => buildEntry({ ...validProvenance, authority: 'PROVEN' }),
  /only enumerable data properties/
);
assert.throws(
  () => buildEntry({ hash: validProvenance.hash, kind: validProvenance.kind }),
  /exactly hash, kind, and sequence/
);
assert.throws(
  () => buildEntry({ ...validProvenance, sequence: 0 }),
  /positive integer/
);
assert.throws(
  () => buildEntry({ ...validProvenance, sequence: 1.5 }),
  /positive integer/
);
const accessorProvenance = { kind: 'core', sequence: 1 };
Object.defineProperty(accessorProvenance, 'hash', {
  enumerable: true,
  get() {
    return 'sha256:accessor';
  }
});
assert.throws(
  () => buildEntry(accessorProvenance),
  /only enumerable data properties/
);

const { ledger, verifiedLedger } = buildResearchMemoryLedger({
  prefix: 'structured-memory-provenance-boundary'
});
const memory = memoryFromLedger({ ledger: verifiedLedger });
const entry = memory.entries[0];
const record = verifiedLedger.records.find((candidate) => candidate.kind === 'core');
assert.equal(entry.provenance.kind, record.kind);
assert.equal(entry.provenance.sequence, record.sequence);
assert.equal(entry.provenance.hash, record.hash);
assert.deepEqual(
  Object.keys(entry.provenance).sort(),
  ['hash', 'kind', 'sequence']
);
assert.throws(
  () => {
    entry.provenance.hash = 'sha256:forged';
  },
  TypeError
);
assert.equal(entry.provenance.hash, record.hash);

const retrieval = memory.query({
  source: MEMORY_SOURCES.RESEARCH,
  keywords: ['research-required'],
  limit: 1
});
assert.equal(Object.isFrozen(retrieval.results[0]), true);
assert.equal(Object.isFrozen(retrieval.results[0].provenance), true);
assert.deepEqual(retrieval.results[0].provenance, entry.provenance);
assert.equal(retrieval.results[0].dataOnly, true);
assert.equal(retrieval.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(retrieval.results[0], 'authority'), false);
assert.equal(Object.hasOwn(retrieval.results[0], 'actionReport'), false);

assert.throws(
  () => memoryFromLedger({ ledger: { records: verifiedLedger.records } }),
  /trusted evidence ledger/
);
const tampered = JSON.parse(ledger.serialize());
tampered.records[0].hash = 'sha256:forged';
assert.throws(
  () => memoryFromLedger({ ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered)) }),
  /hash verification failed/
);

const forgedShape = Object.create(StructuredMemoryEntry.prototype);
assert.equal(isTrustedStructuredMemoryEntry(forgedShape), false);
assert.equal(entry.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(entry.dataOnly, true);
assert.equal(entry.historicalOnly, true);

console.log(
  `FLUID_STRUCTURED_MEMORY_PROVENANCE_BOUNDARY_OK forgedMetadataRejected=true `
  + `accessorRejected=true invalidSequenceRejected=true immutable=true `
  + `chainMatch=true fakeLedgerRejected=true tamperedRejected=true `
  + `dataOnly=${entry.dataOnly} historicalOnly=${entry.historicalOnly} authoritySuppressed=true`
);
