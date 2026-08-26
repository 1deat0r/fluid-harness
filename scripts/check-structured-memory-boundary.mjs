import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  BoundedStructuredMemory,
  StructuredMemoryEntry,
  isTrustedBoundedStructuredMemory,
  memoryFromAgentRun
} from '../src/memory.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

function entryOptions(id, overrides = {}) {
  return {
    id,
    taskId: id,
    description: 'Find a graph path',
    strategyKey: 'graph-algorithms',
    evidence: EVIDENCE_LEVELS.PROVEN,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0.2,
    predictionError: false,
    actionNumber: 1,
    keywords: ['graph', 'path'],
    ...overrides
  };
}

function entry(id, overrides = {}) {
  return new StructuredMemoryEntry(entryOptions(id, overrides));
}

const malformed = {
  id: 'memory-boundary-malformed',
  taskId: 'memory-boundary-malformed',
  description: 'Find a graph path',
  strategyKey: 'graph-algorithms',
  evidence: 'FORGED',
  surpriseBand: SURPRISE_BANDS.LOW,
  surpriseNats: 0.2,
  predictionError: false,
  keywords: []
};
assert.throws(
  () => new BoundedStructuredMemory({ entries: [malformed] }),
  /evidence is invalid/
);

const accessorOptions = entryOptions('memory-boundary-accessor');
Object.defineProperty(accessorOptions, 'id', {
  enumerable: true,
  configurable: true,
  get() {
    return 'memory-boundary-accessor';
  }
});
assert.throws(
  () => new StructuredMemoryEntry(accessorOptions),
  /only enumerable data properties/
);

const accessorKeywords = [];
Object.defineProperty(accessorKeywords, '0', {
  enumerable: true,
  get() {
    return 'graph';
  }
});
Object.defineProperty(accessorKeywords, 'length', {
  value: 1,
  writable: true,
  enumerable: false,
  configurable: false
});
assert.throws(
  () => new StructuredMemoryEntry({
    ...entryOptions('memory-boundary-keyword-accessor'),
    keywords: accessorKeywords
  }),
  /only enumerable data entries/
);

const base = new BoundedStructuredMemory({
  entries: [entry('memory-boundary-one')],
  maxEntries: 2
});
assert.equal(isTrustedBoundedStructuredMemory(base), true);
assert.throws(
  () => new BoundedStructuredMemory({
    entries: [base.entries[0], base.entries[0]]
  }),
  /duplicated/
);
const full = base.add(entry('memory-boundary-two', { actionNumber: 2 }));
assert.throws(
  () => full.add(entry('memory-boundary-three', { actionNumber: 3 })),
  /capacity is exhausted/
);
assert.throws(
  () => full.query({ limit: 33 }),
  /limit must be a positive integer/
);
assert.throws(
  () => full.query({ unknown: true }),
  /only enumerable data properties/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'limit', {
  enumerable: true,
  get() {
    return 1;
  }
});
assert.throws(
  () => full.query(accessorQuery),
  /only enumerable data properties/
);

const forgedRun = {
  cycles: [],
  pendingResearch: []
};
assert.throws(
  () => memoryFromAgentRun({ runReport: forgedRun }),
  /trusted agent run report/
);

const runner = new BoundedAgentRunner();
const realRun = runner.run({
  episodes: [{
    task: { id: 'memory-boundary-real', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const memory = memoryFromAgentRun({ runReport: realRun, idPrefix: 'memory-boundary' });
const result = memory.query({ strategyKey: 'graph-algorithms' });
assert.equal(result.dataOnly, true);
assert.equal(result.historicalOnly, true);
assert.equal(Object.hasOwn(result.results[0], 'actionReport'), false);
assert.equal(Object.isFrozen(result.results), true);

console.log(
  `FLUID_STRUCTURED_MEMORY_BOUNDARY_OK malformedRejected=true accessorRejected=true `
  + `duplicateRejected=true capacityRejected=true forgedRunRejected=true proofSuppressed=true `
  + `immutable=${Object.isFrozen(result)}`
);
