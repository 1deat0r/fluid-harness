import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  MemoryAwareAgentLedgerReceipt,
  isTrustedMemoryAwareAgentLedgerReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function makePlanner(plannerId) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphFromMemory',
      timeoutMs: 2000
    }),
    plannerId
  });
}

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-persistence-boundary-history', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner: makePlanner('memory-aware-persistence-boundary')
});

assert.throws(
  () => agent.persistRun({ ledger: verifiedLedger }),
  /requires a prior bounded run/
);

agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: { taskId: 'memory-aware-persistence-boundary-task' }
});
assert.throws(
  () => agent.persistRun({ ledger: {} }),
  /requires a trusted evidence ledger/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'ledger', {
  enumerable: true,
  get() {
    return verifiedLedger;
  }
});
assert.throws(
  () => agent.persistRun(accessorOptions),
  /only enumerable data properties/
);

const ledgerReceipt = agent.persistRun({ ledger: verifiedLedger });
assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(ledgerReceipt), true);
assert.throws(
  () => agent.persistRun({ ledger: verifiedLedger }),
  /already wrote this ledger/
);
assert.throws(
  () => new MemoryAwareAgentLedgerReceipt({
    record: { kind: 'agent-run', sequence: 1, hash: 'forged' },
    ledgerLength: 1
  }),
  /factory token/
);
assert.equal(Object.hasOwn(ledgerReceipt, 'actionReport'), false);
assert.equal(Object.hasOwn(ledgerReceipt, 'runReport'), false);
assert.equal(ledgerReceipt.authorityTransferred, false);
assert.equal(Object.isFrozen(ledgerReceipt), true);
assert.throws(() => {
  ledgerReceipt.sequence = 99;
}, TypeError);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_PERSISTENCE_BOUNDARY_OK priorRunRejected=true `
  + `forgedLedgerRejected=true accessorRejected=true duplicateRejected=true `
  + `forgedReceiptRejected=true proofSuppressed=${Object.hasOwn(ledgerReceipt, 'actionReport') === false} `
  + `immutable=${Object.isFrozen(ledgerReceipt)}`
);
