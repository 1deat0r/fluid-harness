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
      id: 'multi-source-agent-run',
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
  idPrefix: 'multi-source'
});
const memory = agentMemory.add(new StructuredMemoryEntry({
  id: 'multi-source-research',
  taskId: 'multi-source-research',
  description: 'Historical research note',
  strategyKey: 'research-result',
  evidence: EVIDENCE_LEVELS.OBSERVED,
  surpriseBand: SURPRISE_BANDS.LOW,
  surpriseNats: 0,
  predictionError: false,
  source: MEMORY_SOURCES.RESEARCH,
  keywords: ['research', 'multi-source']
}));

const retrieval = memory.query({
  sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.AGENT_RUN],
  limit: 4
});
assert.equal(retrieval.totalMatches, 2);
assert.equal(retrieval.returnedCount, 2);
assert.equal(retrieval.query.source, null);
assert.deepEqual(
  retrieval.query.sources,
  [MEMORY_SOURCES.AGENT_RUN, MEMORY_SOURCES.RESEARCH]
);
assert.deepEqual(
  new Set(retrieval.results.map(({ source }) => source)),
  new Set([MEMORY_SOURCES.AGENT_RUN, MEMORY_SOURCES.RESEARCH])
);
assert.equal(retrieval.dataOnly, true);
assert.equal(retrieval.historicalOnly, true);
assert.equal(Object.isFrozen(retrieval.query), true);
assert.equal(Object.isFrozen(retrieval.query.sources), true);
assert.equal(Object.isFrozen(retrieval.results), true);
assert.equal(Object.hasOwn(retrieval.results[0], 'actionReport'), false);

const context = buildStructuredMemoryContext({
  memory,
  query: {
    sources: [MEMORY_SOURCES.RESEARCH, MEMORY_SOURCES.AGENT_RUN],
    limit: 4
  }
});
assert.equal(context.resultCount, 2);
assert.equal(context.dataOnly, true);
assert.equal(context.historicalOnly, true);
assert.equal(context.authorityTransferred, false);
assert.deepEqual(
  context.toPlannerData().query.sources,
  [MEMORY_SOURCES.AGENT_RUN, MEMORY_SOURCES.RESEARCH]
);

console.log(
  `FLUID_STRUCTURED_MEMORY_MULTI_SOURCE_OK sources=${retrieval.query.sources.join(',')} `
  + `results=${retrieval.resultCount ?? retrieval.returnedCount} `
  + `dataOnly=${retrieval.dataOnly} historicalOnly=${retrieval.historicalOnly}`
);
