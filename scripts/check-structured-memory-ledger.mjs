import assert from 'node:assert/strict';

import { BoundedAgentRunner, isTrustedAgentRunReport } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedBoundedStructuredMemory,
  memoryFromLedger
} from '../src/memory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';

const runner = new BoundedAgentRunner();
const report = runner.run({
  episodes: [
    {
      task: { id: 'ledger-memory-success', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    },
    {
      task: { id: 'ledger-memory-surprise', description: 'Find a graph path' },
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
const ledger = new EvidenceLedger();
ledger.appendAgentRun(report);
const restored = EvidenceLedger.fromSerialized(ledger.serialize());
const restoredRuns = restored.restoreAgentRuns();
assert.equal(isTrustedAgentRunReport(restoredRuns[0]), false);

const memory = memoryFromLedger({
  ledger: restored,
  idPrefix: 'ledger-memory'
});
assert.equal(isTrustedBoundedStructuredMemory(memory), true);
assert.equal(memory.size, 3);
assert.equal(memory.entries[0].source, MEMORY_SOURCES.LEDGER);
assert.equal(memory.entries[1].source, MEMORY_SOURCES.LEDGER);
assert.equal(memory.entries[2].source, MEMORY_SOURCES.RESEARCH);
const result = memory.query({
  source: MEMORY_SOURCES.LEDGER,
  keywords: ['graph-algorithms'],
  limit: 2
});
assert.equal(result.totalMatches, 2);
assert.equal(result.results[0].historicalOnly, true);
assert.equal(result.results[0].dataOnly, true);
assert.equal(Object.hasOwn(result.results[0], 'actionReport'), false);
assert.equal(Object.isFrozen(memory), true);

console.log(
  `FLUID_STRUCTURED_MEMORY_LEDGER_OK runs=${restoredRuns.length} entries=${memory.size} researchEntries=1 `
  + `source=${memory.entries[0].source} restoredRunTrusted=${isTrustedAgentRunReport(restoredRuns[0])} `
  + `historicalOnly=${result.results[0].historicalOnly} proofSuppressed=${Object.hasOwn(result.results[0], 'actionReport') === false}`
);
