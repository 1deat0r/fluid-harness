import assert from 'node:assert/strict';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  buildCompletedResearchMemoryLedger,
  buildResearchMemoryLedger
} from './fixtures/research-memory-ledger.mjs';

const { ledger, reports, verifiedLedger } = buildResearchMemoryLedger({
  prefix: 'structured-memory-research'
});
const originalTaskId = reports[0].taskId;
const memory = memoryFromLedger({
  ledger: verifiedLedger,
  idPrefix: 'structured-memory-research'
});

assert.equal(memory.size, 1);
assert.equal(memory.entries[0].source, MEMORY_SOURCES.RESEARCH);
assert.equal(memory.entries[0].strategyKey, 'research-question');
assert.equal(memory.entries[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(memory.entries[0].predictionError, true);
assert.equal(memory.entries[0].taskId, 'research-question:0');
assert.notEqual(memory.entries[0].taskId, originalTaskId);

const result = memory.query({
  source: MEMORY_SOURCES.RESEARCH,
  keywords: ['research-required'],
  limit: 1
});
assert.equal(result.totalMatches, 1);
assert.equal(result.returnedCount, 1);
assert.equal(result.results[0].source, MEMORY_SOURCES.RESEARCH);
assert.equal(result.results[0].historicalOnly, true);
assert.equal(result.results[0].dataOnly, true);
assert.equal(Object.hasOwn(result.results[0], 'action'), false);
assert.equal(Object.hasOwn(result.results[0], 'actionReport'), false);
assert.equal(Object.hasOwn(result.results[0], 'reason'), false);
assert.equal(JSON.stringify(result.results).includes(originalTaskId), false);

const run = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'structured-memory-research-agent-run', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  }],
  stopOnResearchRequired: false
});
const runLedger = new EvidenceLedger();
runLedger.appendAgentRun(run);
const runMemory = memoryFromLedger({ ledger: runLedger });
const runResearch = runMemory.query({ source: MEMORY_SOURCES.RESEARCH });
assert.equal(runMemory.size, 2);
assert.equal(runResearch.returnedCount, 1);
assert.equal(runResearch.results[0].source, MEMORY_SOURCES.RESEARCH);
assert.equal(runResearch.results[0].taskId, 'research-question:0');
assert.notEqual(runResearch.results[0].taskId, run.cycles[0].taskId);

const matchingRun = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: originalTaskId, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  }],
  stopOnResearchRequired: false
});
ledger.appendAgentRun(matchingRun);
const combinedMemory = memoryFromLedger({ ledger });
assert.equal(
  combinedMemory.query({ source: MEMORY_SOURCES.RESEARCH }).returnedCount,
  1
);

const {
  run: completedRun,
  verifiedLedger: completedVerifiedLedger
} = buildCompletedResearchMemoryLedger({
  prefix: 'structured-memory-research-completed'
});
assert.equal(completedRun.pendingResearch.length, 0);
assert.equal(completedRun.cycles[0].research.complete, true);
const completedMemory = memoryFromLedger({ ledger: completedVerifiedLedger });
const completedResult = completedMemory.query({
  source: MEMORY_SOURCES.RESEARCH,
  strategyKey: 'research-result',
  keywords: ['research-complete'],
  limit: 1
});
assert.equal(completedResult.returnedCount, 1);
assert.equal(completedResult.results[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(completedResult.results[0].historicalOnly, true);
assert.equal(completedResult.results[0].dataOnly, true);
assert.equal(Object.hasOwn(completedResult.results[0], 'results'), false);
assert.equal(Object.hasOwn(completedResult.results[0], 'actionReport'), false);
assert.equal(
  JSON.stringify(completedResult.results).includes(completedRun.cycles[0].taskId),
  false
);

console.log(
  `FLUID_STRUCTURED_MEMORY_RESEARCH_OK questions=${memory.size} agentRunQuestions=${runResearch.returnedCount} `
  + `deduplicated=${combinedMemory.query({ source: MEMORY_SOURCES.RESEARCH }).returnedCount} `
  + `completedResults=${completedResult.returnedCount} `
  + `source=${result.results[0].source} evidence=${result.results[0].evidence} `
  + `predictionError=${result.results[0].predictionError} historicalOnly=${result.results[0].historicalOnly} `
  + `authoritySuppressed=${Object.hasOwn(result.results[0], 'actionReport') === false}`
);
