import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  StructuredMemoryEntry,
  buildStructuredMemoryContext,
  memoryFromAgentRun,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

const runReport = new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'source-counts-agent-run',
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
const agentMemory = memoryFromAgentRun({
  runReport,
  idPrefix: 'source-counts'
});
const memory = agentMemory.add(new StructuredMemoryEntry({
  id: 'source-counts-research',
  taskId: 'source-counts-research',
  description: 'Historical research note',
  strategyKey: 'research-result',
  evidence: EVIDENCE_LEVELS.OBSERVED,
  surpriseBand: SURPRISE_BANDS.LOW,
  surpriseNats: 0,
  predictionError: false,
  source: MEMORY_SOURCES.RESEARCH,
  keywords: ['research', 'source-counts']
}));
const agentRunCount = memory.entries.filter(
  ({ source }) => source === MEMORY_SOURCES.AGENT_RUN
).length;

const sparseRetrieval = memory.query({
  sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY]
});
assert.equal(sparseRetrieval.returnedCount, 1);
assert.deepEqual(sparseRetrieval.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 0,
  RESEARCH: 1
});

const combinedRetrieval = memory.query({
  sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.AGENT_RUN]
});
assert.equal(combinedRetrieval.returnedCount, agentRunCount + 1);
assert.deepEqual(combinedRetrieval.sourceCounts, {
  AGENT_RUN: agentRunCount,
  RESEARCH: 1
});
assert.equal(Object.isFrozen(combinedRetrieval.sourceCounts), true);

const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.AGENT_RUN]
  }
});
assert.deepEqual(context.sourceCounts, combinedRetrieval.sourceCounts);
assert.deepEqual(context.toPlannerData().sourceCounts, {
  AGENT_RUN: agentRunCount,
  RESEARCH: 1
});
assert.equal(Object.isFrozen(context.sourceCounts), true);
assert.equal(Object.isFrozen(context.toPlannerData().sourceCounts), true);
assert.equal(context.dataOnly, true);
assert.equal(context.historicalOnly, true);
assert.equal(context.authorityTransferred, false);

console.log(
  `FLUID_STRUCTURED_MEMORY_SOURCE_COUNTS_OK `
  + `sources=${Object.keys(combinedRetrieval.sourceCounts).join(',')} `
  + `agentRun=${agentRunCount} research=1 zeroSource=ARCHITECTURE_DISCOVERY `
  + `frozen=true dataOnly=${context.dataOnly} historicalOnly=${context.historicalOnly}`
);
