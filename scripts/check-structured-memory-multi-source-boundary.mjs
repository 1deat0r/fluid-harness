import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  memoryFromAgentRun,
  MEMORY_SOURCES
} from '../src/memory.mjs';

const runReport = new BoundedAgentRunner().run({
  episodes: [{
    task: {
      id: 'multi-source-boundary-task',
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
const memory = memoryFromAgentRun({
  runReport,
  idPrefix: 'multi-source-boundary'
});
const initialSize = memory.size;
const initialIds = memory.entries.map(({ id }) => id);

assert.throws(
  () => memory.query({ sources: [] }),
  /must contain at least one source/
);
assert.throws(
  () => memory.query({ sources: [MEMORY_SOURCES.AGENT_RUN, MEMORY_SOURCES.AGENT_RUN] }),
  /entries must be unique/
);
assert.throws(
  () => memory.query({ sources: ['FORGED'] }),
  /entry 0 is invalid/
);
assert.throws(
  () => memory.query({ sources: MEMORY_SOURCES.AGENT_RUN }),
  /must be an array/
);
assert.throws(
  () => memory.query({
    source: MEMORY_SOURCES.AGENT_RUN,
    sources: [MEMORY_SOURCES.RESEARCH]
  }),
  /cannot use source and sources together/
);

const accessorSources = [];
Object.defineProperty(accessorSources, '0', {
  enumerable: true,
  configurable: true,
  get() {
    throw new Error('source accessor should not be read');
  }
});
assert.throws(
  () => memory.query({ sources: accessorSources }),
  /only enumerable data entries/
);

const accessorQuery = {};
Object.defineProperty(accessorQuery, 'sources', {
  enumerable: true,
  configurable: true,
  get() {
    throw new Error('query accessor should not be read');
  }
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);

assert.equal(memory.size, initialSize);
assert.deepEqual(memory.entries.map(({ id }) => id), initialIds);
assert.equal(Object.isFrozen(memory), true);

console.log(
  `FLUID_STRUCTURED_MEMORY_MULTI_SOURCE_BOUNDARY_OK emptyRejected=true `
  + `duplicateRejected=true invalidRejected=true scalarRejected=true `
  + `conflictRejected=true accessorRejected=true unchanged=${memory.size === initialSize}`
);
