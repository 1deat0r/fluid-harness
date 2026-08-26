import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentLedgerReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function planner(plannerId) {
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
    task: { id: 'memory-aware-persistence-history', description: 'Find a graph path' },
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
const firstAgent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner: planner('memory-aware-persistence-first')
});
const firstReceipt = firstAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-persistence-first-task',
    description: 'Find a graph path'
  }
});
const ledgerReceipt = firstAgent.persistRun({ ledger: verifiedLedger });

assert.equal(isTrustedMemoryAwareAgentLedgerReceipt(ledgerReceipt), true);
assert.equal(ledgerReceipt.kind, 'agent-run');
assert.equal(ledgerReceipt.sequence, 2);
assert.equal(ledgerReceipt.ledgerLength, 2);
assert.equal(typeof ledgerReceipt.hash, 'string');
assert.equal(ledgerReceipt.dataOnly, true);
assert.equal(ledgerReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(ledgerReceipt, 'actionReport'), false);
assert.equal(Object.hasOwn(ledgerReceipt, 'runReport'), false);
assert.equal(Object.isFrozen(ledgerReceipt), true);

const nextLedger = EvidenceLedger.fromSerialized(verifiedLedger.serialize());
const secondAgent = memoryAwareAgentFromLedger({
  ledger: nextLedger,
  planner: planner('memory-aware-persistence-second')
});
const secondReceipt = secondAgent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 2 },
  context: {
    taskId: 'memory-aware-persistence-second-task',
    description: 'Find a graph path'
  }
});

assert.equal(firstReceipt.memoryContext.resultCount, 1);
assert.equal(secondReceipt.memoryContext.resultCount, 2);
assert.equal(secondReceipt.run.priorWorldModelHistoryLength, 2);
assert.equal(secondReceipt.run.completed, true);
assert.deepEqual(secondReceipt.run.actionEvidence, ['PROVEN']);
assert.equal(secondReceipt.run.actionsUsed, 1);
assert.equal(secondReceipt.authorityTransferred, false);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_PERSISTENCE_OK firstMemory=${firstReceipt.memoryContext.resultCount} `
  + `persistedSequence=${ledgerReceipt.sequence} ledgerLength=${ledgerReceipt.ledgerLength} `
  + `nextMemory=${secondReceipt.memoryContext.resultCount} `
  + `nextWorldModelHistory=${secondReceipt.run.priorWorldModelHistoryLength} `
  + `proof=${secondReceipt.run.actionEvidence[0]} authorityTransferred=${secondReceipt.authorityTransferred}`
);
