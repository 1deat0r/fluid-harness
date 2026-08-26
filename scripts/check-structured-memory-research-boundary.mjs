import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  BoundedStructuredMemory,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import {
  buildCompletedResearchMemoryLedger,
  buildResearchMemoryLedger
} from './fixtures/research-memory-ledger.mjs';

const { ledger, reports, verifiedLedger } = buildResearchMemoryLedger({
  prefix: 'structured-memory-research-boundary',
  count: 2
});

assert.throws(
  () => memoryFromLedger({ ledger: {} }),
  /trusted evidence ledger/
);
assert.throws(
  () => new BoundedStructuredMemory({ maxEntries: 1 }).rememberLedger({
    ledger: verifiedLedger
  }),
  /exceeds remaining capacity/
);

const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.RESEARCH;
  }
});
const memory = memoryFromLedger({ ledger: verifiedLedger });
assert.throws(
  () => memory.query({ source: 'FORGED' }),
  /source is invalid/
);
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
assert.equal(
  memory.query({ source: MEMORY_SOURCES.AGENT_RUN }).totalMatches,
  0
);

const tampered = JSON.parse(ledger.serialize());
tampered.records[0].payload.researchQueue[0].reason = 'forged';
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /hash verification failed/
);

assert.equal(memory.size, reports.length);
assert.equal(
  memory.entries.every((entry) => (
    entry.source === MEMORY_SOURCES.RESEARCH
    && entry.dataOnly
    && entry.historicalOnly
    && entry.evidence === 'OBSERVED'
    && !Object.hasOwn(entry, 'action')
    && !Object.hasOwn(entry, 'actionReport')
    && !reports.some((report) => entry.taskId === report.taskId)
  )),
  true
);

const {
  run: completedRun,
  verifiedLedger: completedVerifiedLedger
} = buildCompletedResearchMemoryLedger({
  prefix: 'structured-memory-research-boundary-completed'
});
const completedMemory = memoryFromLedger({ ledger: completedVerifiedLedger });
const completedResult = completedMemory.query({
  source: MEMORY_SOURCES.RESEARCH,
  strategyKey: 'research-result'
});
assert.equal(completedResult.returnedCount, 1);
assert.equal(Object.hasOwn(completedResult.results[0], 'winner'), false);
assert.equal(Object.hasOwn(completedResult.results[0], 'promoted'), false);
assert.equal(Object.hasOwn(completedResult.results[0], 'results'), false);
assert.equal(Object.hasOwn(completedResult.results[0], 'actionReport'), false);
assert.equal(
  JSON.stringify(completedResult.results).includes(completedRun.cycles[0].taskId),
  false
);

console.log(
  `FLUID_STRUCTURED_MEMORY_RESEARCH_BOUNDARY_OK forgedLedgerRejected=true `
  + `capacityRejected=true invalidSourceRejected=true accessorRejected=true `
  + `tamperedRejected=true sourceMismatch=0 completedArtifactSuppressed=true `
  + `dataOnly=true historicalOnly=true `
  + `authoritySuppressed=${memory.entries.every((entry) => !Object.hasOwn(entry, 'actionReport'))}`
);
