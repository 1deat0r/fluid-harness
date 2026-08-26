import assert from 'node:assert/strict';

import { BoundedAgentRunner, isTrustedAgentRunReport } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  BoundedStructuredMemory,
  memoryFromAgentRun,
  memoryFromLedger
} from '../src/memory.mjs';

const runner = new BoundedAgentRunner();
const report = runner.run({
  episodes: [
    {
      task: { id: 'ledger-memory-boundary-one', description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      }
    },
    {
      task: { id: 'ledger-memory-boundary-two', description: 'Find a graph path' },
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
const restoredRun = restored.restoreAgentRuns()[0];
assert.equal(isTrustedAgentRunReport(restoredRun), false);
assert.throws(
  () => memoryFromAgentRun({ runReport: restoredRun }),
  /trusted agent run report/
);

assert.throws(
  () => memoryFromLedger({ ledger: {} }),
  /trusted evidence ledger/
);
assert.throws(
  () => new BoundedStructuredMemory({ maxEntries: 1 }).rememberLedger({ ledger: restored }),
  /exceeds remaining capacity/
);

const accessorOptions = { ledger: restored };
Object.defineProperty(accessorOptions, 'idPrefix', {
  enumerable: true,
  get() {
    return 'forged';
  }
});
assert.throws(
  () => memoryFromLedger(accessorOptions),
  /only enumerable data properties/
);

const serialized = ledger.serialize();
const tampered = serialized.replace('ledger-memory-boundary-one', 'ledger-memory-boundary-tampered');
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(tampered)
  }),
  /hash|integrity|invalid/i
);

console.log(
  `FLUID_STRUCTURED_MEMORY_LEDGER_BOUNDARY_OK forgedLedgerRejected=true `
  + `restoredRunRejected=true capacityRejected=true accessorRejected=true `
  + `tamperedRejected=true authoritySuppressed=${isTrustedAgentRunReport(restoredRun) === false}`
);
