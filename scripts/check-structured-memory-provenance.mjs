import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  memoryFromAgentRun,
  memoryFromLedger,
  StructuredMemoryEntry,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';
import { buildMemoryAwareCoordinationLedger } from './fixtures/memory-aware-coordination-ledger.mjs';
import { buildMemoryAwareSessionLedger } from './fixtures/memory-aware-session-ledger.mjs';
import {
  buildCompletedResearchMemoryLedger,
  buildResearchMemoryLedger
} from './fixtures/research-memory-ledger.mjs';

function assertLedgerProvenance({ memory, ledger, source, kind }) {
  const records = ledger.records.filter((record) => record.kind === kind);
  const entries = memory.entries.filter((entry) => entry.source === source);
  assert.equal(entries.length, records.length);
  entries.forEach((entry) => {
    assert.equal(Object.isFrozen(entry.provenance), true);
    const record = records.find((candidate) => candidate.hash === entry.provenance.hash);
    assert.ok(record);
    assert.equal(entry.provenance.kind, record.kind);
    assert.equal(entry.provenance.sequence, record.sequence);
    assert.equal(entry.dataOnly, true);
    assert.equal(entry.historicalOnly, true);
    assert.equal(Object.hasOwn(entry, 'action'), false);
    assert.equal(Object.hasOwn(entry, 'actionReport'), false);
    assert.equal(Object.hasOwn(entry, 'authority'), false);
    assert.equal(Object.hasOwn(entry, 'verified'), false);
  });
  const retrieval = memory.query({ source, limit: memory.size });
  assert.equal(retrieval.results.length, entries.length);
  retrieval.results.forEach((result) => {
    const entry = entries.find((candidate) => candidate.id === result.id);
    assert.ok(entry);
    assert.deepEqual(result.provenance, entry.provenance);
    assert.equal(Object.isFrozen(result.provenance), true);
    assert.equal(result.dataOnly, true);
    assert.equal(result.historicalOnly, true);
  });
  return entries.length;
}

const researchQueue = buildResearchMemoryLedger({
  prefix: 'structured-memory-provenance-queue'
});
const queueMemory = memoryFromLedger({ ledger: researchQueue.verifiedLedger });
const queueEntries = assertLedgerProvenance({
  memory: queueMemory,
  ledger: researchQueue.verifiedLedger,
  source: MEMORY_SOURCES.RESEARCH,
  kind: 'core'
});

const completedResearch = buildCompletedResearchMemoryLedger({
  prefix: 'structured-memory-provenance-completed'
});
const completedMemory = memoryFromLedger({ ledger: completedResearch.verifiedLedger });
const completedLedgerEntries = assertLedgerProvenance({
  memory: completedMemory,
  ledger: completedResearch.verifiedLedger,
  source: MEMORY_SOURCES.LEDGER,
  kind: 'agent-run'
});
const completedResearchEntries = completedMemory.entries.filter(
  (entry) => entry.source === MEMORY_SOURCES.RESEARCH
);
assert.equal(completedResearchEntries.length, 1);
assert.equal(completedResearchEntries[0].provenance.kind, 'agent-run');

const discoveryLedger = new EvidenceLedger();
discoveryLedger.appendArchitectureDiscovery(buildArchitectureDiscoveryReport({
  caseId: 'structured-memory-provenance-discovery-case',
  plannerId: 'structured-memory-provenance-discovery-planner',
  goal: 'provenance discovery'
}));
const discoveryMemory = memoryFromLedger({ ledger: discoveryLedger });
const discoveryEntries = assertLedgerProvenance({
  memory: discoveryMemory,
  ledger: discoveryLedger,
  source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
  kind: 'architecture-discovery'
});

const coordination = buildMemoryAwareCoordinationLedger({
  prefix: 'structured-memory-provenance-coordination'
});
const coordinationMemory = memoryFromLedger({ ledger: coordination.verifiedLedger });
const coordinationEntries = assertLedgerProvenance({
  memory: coordinationMemory,
  ledger: coordination.verifiedLedger,
  source: MEMORY_SOURCES.COORDINATION,
  kind: 'memory-aware-coordination'
});

const session = buildMemoryAwareSessionLedger({
  prefix: 'structured-memory-provenance-session'
});
const sessionMemory = memoryFromLedger({ ledger: session.verifiedLedger });
const sessionEntries = assertLedgerProvenance({
  memory: sessionMemory,
  ledger: session.verifiedLedger,
  source: MEMORY_SOURCES.SESSION,
  kind: 'memory-aware-session'
});

const callerEntry = new StructuredMemoryEntry({
  id: 'structured-memory-provenance-caller',
  taskId: 'structured-memory-provenance-caller-task',
  description: 'Caller-owned historical summary',
  strategyKey: 'caller-summary',
  evidence: EVIDENCE_LEVELS.OBSERVED,
  surpriseBand: SURPRISE_BANDS.LOW,
  surpriseNats: 0,
  predictionError: false,
  source: MEMORY_SOURCES.CALLER,
  keywords: ['caller']
});
assert.equal(callerEntry.provenance, null);
assert.equal(memoryFromAgentRun({ runReport: completedResearch.run }).entries[0].provenance, null);

console.log(
  `FLUID_STRUCTURED_MEMORY_PROVENANCE_OK queue=${queueEntries} `
  + `agentRun=${completedLedgerEntries} completedResearch=${completedResearchEntries.length} `
  + `discovery=${discoveryEntries} coordination=${coordinationEntries} session=${sessionEntries} `
  + `frozen=true dataOnly=true historicalOnly=true authoritySuppressed=true`
);
