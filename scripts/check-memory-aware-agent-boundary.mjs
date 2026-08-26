import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  MemoryAwareAgent,
  MemoryAwareAgentRunReport,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { memoryFromLedger } from '../src/memory.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-boundary-history', description: 'Find a graph path' },
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
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const memory = memoryFromLedger({
  ledger: restoredLedger,
  idPrefix: 'memory-aware-boundary'
});

function plannerWithId(plannerId) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphFromMemory',
      timeoutMs: 2000
    }),
    plannerId
  });
}

const planner = plannerWithId('memory-aware-boundary-planner');
const freshRunner = new BoundedAgentRunner();
const agent = new MemoryAwareAgent({
  memory,
  planner,
  runner: freshRunner
});

assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: {},
    planner,
    runner: new BoundedAgentRunner()
  }),
  /trusted evidence ledger/
);
assert.throws(
  () => new MemoryAwareAgent({
    memory: {},
    planner,
    runner: new BoundedAgentRunner()
  }),
  /trusted structured memory/
);
assert.throws(
  () => new MemoryAwareAgent({
    memory,
    planner: {},
    runner: new BoundedAgentRunner()
  }),
  /trusted agent planner/
);
assert.throws(
  () => new MemoryAwareAgent({
    memory,
    planner,
    runner: new BoundedAgentRunner(),
    historicalWorldModelHistoryLength: 1
  }),
  /requires the ledger factory/
);

const usedRunner = new BoundedAgentRunner();
usedRunner.run({
  episodes: [{
    task: { id: 'memory-aware-used-runner', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
assert.throws(
  () => new MemoryAwareAgent({
    memory,
    planner,
    runner: usedRunner
  }),
  /fresh active bounded runner/
);

const accessorOptions = { goal: 'graph' };
Object.defineProperty(accessorOptions, 'query', {
  enumerable: true,
  get() {
    return { keywords: ['graph-algorithms'] };
  }
});
assert.throws(
  () => agent.run(accessorOptions),
  /only enumerable data properties/
);

const cyclicContext = {};
cyclicContext.self = cyclicContext;
assert.throws(
  () => agent.run({
    goal: 'graph',
    context: cyclicContext
  }),
  /plain objects and arrays|must not contain cycles/
);

const validReceipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: { taskId: 'memory-aware-boundary-task' }
});

assert.throws(
  () => new MemoryAwareAgentRunReport({
    plan: {},
    runReport: {},
    memoryContext: {}
  }),
  /trusted episode plan/
);
assert.equal(Object.hasOwn(validReceipt, 'actionReport'), false);
assert.equal(Object.hasOwn(validReceipt.run, 'actionReport'), false);
assert.equal(validReceipt.authorityTransferred, false);
assert.equal(Object.isFrozen(validReceipt), true);
assert.equal(Object.isFrozen(validReceipt.run), true);
assert.throws(() => {
  validReceipt.authorityTransferred = true;
}, TypeError);
assert.throws(
  () => agent.run({ goal: 'graph' }),
  /fresh active bounded runner/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_BOUNDARY_OK forgedMemoryRejected=true `
  + `forgedPlannerRejected=true forgedHistoryRejected=true usedRunnerRejected=true `
  + `accessorRejected=true cycleRejected=true oneShotRejected=true `
  + `proofSuppressed=${Object.hasOwn(validReceipt, 'actionReport') === false} `
  + `immutable=${Object.isFrozen(validReceipt)}`
);
