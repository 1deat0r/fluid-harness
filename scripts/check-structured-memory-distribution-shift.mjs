import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  EVIDENCE_LEVELS
} from '../src/evidence.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'distribution-shift-memory'
});
const ledger = new EvidenceLedger();
const record = ledger.appendDistributionShift(report);
const memory = memoryFromLedger({
  ledger,
  idPrefix: 'distribution-shift-memory',
  maxEntries: 8
});
const retrieval = memory.query({
  source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
  strategyKey: 'distribution-shift',
  keywords: ['distribution-shift', 'weakness-exposed'],
  limit: 4
});

assert.equal(retrieval.totalMatches, 1);
assert.equal(retrieval.returnedCount, 1);
const entry = retrieval.results[0];
assert.equal(entry.source, MEMORY_SOURCES.DISTRIBUTION_SHIFT);
assert.equal(entry.strategyKey, 'distribution-shift');
assert.equal(entry.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(entry.surpriseNats, 0);
assert.equal(entry.predictionError, false);
assert.equal(entry.actionNumber, null);
assert.equal(entry.architectureId, report.candidateId);
assert.equal(entry.provenance.kind, 'distribution-shift');
assert.equal(entry.provenance.sequence, record.sequence);
assert.equal(entry.provenance.hash, record.hash);
assert.equal(Object.isFrozen(entry), true);
assert.equal(Object.isFrozen(entry.provenance), true);
assert.equal(Object.hasOwn(entry, 'runner'), false);
assert.equal(Object.hasOwn(entry, 'harness'), false);
assert.equal(Object.hasOwn(entry, 'actionReport'), false);
assert.equal(Object.hasOwn(entry, 'shiftCases'), false);
assert.equal(Object.hasOwn(entry, 'promotionAuthority'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_DISTRIBUTION_SHIFT_OK entries=${memory.size} `
  + `matches=${retrieval.totalMatches} source=${entry.source} strategy=${entry.strategyKey} `
  + `evidence=${entry.evidence} statusKeyword=${entry.keywords.includes('weakness-exposed')} `
  + `provenance=${entry.provenance.kind}:${entry.provenance.sequence} `
  + `historicalOnly=${entry.historicalOnly} authoritySuppressed=true`
);
