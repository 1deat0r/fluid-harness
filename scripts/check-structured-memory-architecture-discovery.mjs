import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  memoryFromAgentRun,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';
import { buildArchitectureDiscoveryReport } from './fixtures/architecture-discovery-ledger.mjs';

const adoptedReport = buildArchitectureDiscoveryReport({
  caseId: 'structured-memory-architecture-adopted-case',
  plannerId: 'structured-memory-architecture-adopted-planner',
  goal: 'remember an adopted bounded architecture'
});
const rejectedReport = buildArchitectureDiscoveryReport({
  expected: () => false,
  caseId: 'structured-memory-architecture-rejected-case',
  plannerId: 'structured-memory-architecture-rejected-planner',
  goal: 'remember a rejected bounded architecture'
});
const ledger = new EvidenceLedger();
ledger.appendArchitectureDiscovery(adoptedReport);
ledger.appendArchitectureDiscovery(rejectedReport);
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const agentRun = new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'structured-memory-architecture-agent-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const memoryWithAgentRun = memoryFromAgentRun({
  runReport: agentRun,
  maxEntries: 3,
  idPrefix: 'structured-memory-architecture-agent'
});
const memory = memoryWithAgentRun.rememberLedger({
  ledger: restoredLedger,
  idPrefix: 'structured-memory-architecture'
});

assert.equal(memory.size, 3);
assert.equal(memory.entries[0].source, MEMORY_SOURCES.AGENT_RUN);
assert.equal(memory.entries[1].source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(memory.entries[2].source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(memory.entries[1].strategyKey, 'architecture-discovery');
assert.equal(memory.entries[1].evidence, 'OBSERVED');
assert.equal(memory.entries[1].surpriseBand, SURPRISE_BANDS.LOW);
assert.equal(memory.entries[1].surpriseNats, 0);
assert.equal(memory.entries[1].predictionError, false);
assert.equal(memory.entries[1].historicalOnly, true);
assert.equal(memory.entries[1].dataOnly, true);

const adopted = memory.query({
  source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
  strategyKey: 'architecture-discovery',
  keywords: ['adopted'],
  limit: 2
});
assert.equal(adopted.totalMatches, 1);
assert.equal(adopted.results[0].source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(adopted.results[0].architectureId, adoptedReport.winnerId);
assert.equal(adopted.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(adopted.results[0], 'actionReport'), false);

const rejected = memory.query({
  source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
  strategyKey: 'architecture-discovery',
  keywords: ['rejected'],
  limit: 2
});
assert.equal(rejected.totalMatches, 1);
assert.equal(rejected.results[0].source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(rejected.results[0].architectureId, rejectedReport.winnerId);
assert.equal(rejected.results[0].evidence, 'OBSERVED');
assert.equal(rejected.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(rejected.results[0], 'actionReport'), false);
const agentOnly = memory.query({ source: MEMORY_SOURCES.AGENT_RUN });
assert.equal(agentOnly.totalMatches, 1);
assert.equal(agentOnly.query.source, MEMORY_SOURCES.AGENT_RUN);
assert.equal(Object.isFrozen(memory), true);

console.log(
  `FLUID_STRUCTURED_MEMORY_ARCHITECTURE_DISCOVERY_OK entries=${memory.size} `
  + `adopted=${adopted.totalMatches} rejected=${rejected.totalMatches} `
  + `source=${rejected.results[0].source} agentOnly=${agentOnly.totalMatches} `
  + `evidence=${rejected.results[0].evidence} `
  + `historicalOnly=${rejected.results[0].historicalOnly} proofSuppressed=`
  + `${Object.hasOwn(rejected.results[0], 'actionReport') === false}`
);
