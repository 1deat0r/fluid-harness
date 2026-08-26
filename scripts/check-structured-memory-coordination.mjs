import assert from 'node:assert/strict';

import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildMemoryAwareCoordinationLedger } from './fixtures/memory-aware-coordination-ledger.mjs';

const { verifiedLedger } = buildMemoryAwareCoordinationLedger({
  prefix: 'structured-memory-coordination'
});
const memory = memoryFromLedger({ ledger: verifiedLedger });
const coordination = memory.query({
  source: MEMORY_SOURCES.COORDINATION,
  strategyKey: 'memory-aware-coordination',
  keywords: ['quorum']
});
const ledgerRuns = memory.query({ source: MEMORY_SOURCES.LEDGER });

assert.equal(coordination.totalMatches, 1);
assert.equal(coordination.results[0].source, MEMORY_SOURCES.COORDINATION);
assert.equal(coordination.results[0].architectureId, null);
assert.equal(coordination.results[0].evidence, 'OBSERVED');
assert.equal(coordination.results[0].surpriseNats, 0);
assert.equal(coordination.results[0].historicalOnly, true);
assert.equal(coordination.results[0].dataOnly, true);
assert.equal(coordination.query.source, MEMORY_SOURCES.COORDINATION);
assert.equal(ledgerRuns.totalMatches, 5);
assert.equal(Object.hasOwn(coordination.results[0], 'rounds'), false);
assert.equal(Object.hasOwn(coordination.results[0], 'peerMessages'), false);
assert.equal(Object.hasOwn(coordination.results[0], 'agents'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_COORDINATION_OK coordination=${coordination.totalMatches} `
  + `ledgerRuns=${ledgerRuns.totalMatches} source=${coordination.results[0].source} `
  + `evidence=${coordination.results[0].evidence} historicalOnly=${coordination.results[0].historicalOnly} `
  + `authoritySuppressed=${Object.hasOwn(coordination.results[0], 'rounds') === false}`
);
