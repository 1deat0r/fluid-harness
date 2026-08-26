import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  isTrustedBoundedStructuredMemory,
  memoryFromAgentRun
} from '../src/memory.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

const runner = new BoundedAgentRunner();
const runReport = runner.run({
  episodes: [
    {
      task: { id: 'structured-memory-success', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    },
    {
      task: { id: 'structured-memory-surprise', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [],
        start: 'A',
        goal: 'B'
      }
    }
  ],
  stopOnResearchRequired: false
});

const memory = memoryFromAgentRun({
  runReport,
  idPrefix: 'structured-memory'
});
assert.equal(isTrustedBoundedStructuredMemory(memory), true);
assert.equal(memory.size, 2);

const highSurprise = memory.query({
  keywords: ['GRAPH-ALGORITHMS'],
  surpriseBand: SURPRISE_BANDS.HIGH,
  limit: 4
});
assert.equal(highSurprise.totalMatches, 1);
assert.equal(highSurprise.returnedCount, 1);
assert.equal(highSurprise.results[0].taskId, 'structured-memory-surprise');
assert.equal(highSurprise.results[0].evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(highSurprise.results[0].dataOnly, true);
assert.equal(highSurprise.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(highSurprise.results[0], 'actionReport'), false);
assert.equal(Object.isFrozen(memory), true);
assert.equal(Object.isFrozen(highSurprise), true);
assert.equal(Object.isFrozen(highSurprise.results[0]), true);

const exactTask = memory.query({
  taskId: 'structured-memory-success',
  evidence: EVIDENCE_LEVELS.PROVEN
});
assert.equal(exactTask.totalMatches, 1);
assert.equal(exactTask.results[0].surpriseBand, SURPRISE_BANDS.LOW);

console.log(
  `FLUID_STRUCTURED_MEMORY_OK entries=${memory.size} highSurprise=${highSurprise.totalMatches} `
  + `top=${highSurprise.results[0].taskId} evidence=${highSurprise.results[0].evidence} `
  + `dataOnly=${highSurprise.dataOnly} historicalOnly=${highSurprise.historicalOnly}`
);
