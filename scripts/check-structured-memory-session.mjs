import assert from 'node:assert/strict';

import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildMemoryAwareSessionLedger } from './fixtures/memory-aware-session-ledger.mjs';

const { verifiedLedger } = buildMemoryAwareSessionLedger({
  prefix: 'structured-memory-session'
});
const memory = memoryFromLedger({ ledger: verifiedLedger });
const sessions = memory.query({
  source: MEMORY_SOURCES.SESSION,
  strategyKey: 'memory-aware-session',
  keywords: ['quorum']
});
const agentRuns = memory.query({ source: MEMORY_SOURCES.LEDGER });

assert.equal(sessions.totalMatches, 1);
assert.equal(sessions.results[0].source, MEMORY_SOURCES.SESSION);
assert.equal(sessions.results[0].architectureId, 'process-architecture-direct');
assert.equal(sessions.results[0].evidence, 'OBSERVED');
assert.equal(sessions.results[0].surpriseNats, 0);
assert.equal(sessions.results[0].historicalOnly, true);
assert.equal(sessions.results[0].dataOnly, true);
assert.equal(sessions.query.source, MEMORY_SOURCES.SESSION);
assert.equal(agentRuns.totalMatches, 5);
assert.equal(Object.hasOwn(sessions.results[0], 'runner'), false);
assert.equal(Object.hasOwn(sessions.results[0], 'coordination'), false);
assert.equal(Object.hasOwn(sessions.results[0], 'discovery'), false);

console.log(
  `FLUID_STRUCTURED_MEMORY_SESSION_OK sessions=${sessions.totalMatches} `
  + `agentRuns=${agentRuns.totalMatches} source=${sessions.results[0].source} `
  + `evidence=${sessions.results[0].evidence} historicalOnly=${sessions.results[0].historicalOnly} `
  + `authoritySuppressed=${Object.hasOwn(sessions.results[0], 'runner') === false}`
);
