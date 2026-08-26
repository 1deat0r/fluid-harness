import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  StructuredMemoryContext,
  buildStructuredMemoryContext,
  isTrustedStructuredMemoryContext,
  memoryFromAgentRun,
  planWithStructuredMemory
} from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const runner = new BoundedAgentRunner();
const runReport = runner.run({
  episodes: [{
    task: { id: 'memory-context-boundary-history', description: 'Find a graph path' },
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
  idPrefix: 'memory-context-boundary'
});
const context = buildStructuredMemoryContext({
  memory,
  query: { keywords: ['graph-algorithms'] }
});
assert.equal(isTrustedStructuredMemoryContext(context), true);

assert.throws(
  () => new StructuredMemoryContext({
    retrieval: {
      query: {},
      results: [],
      returnedCount: 0,
      dataOnly: true,
      historicalOnly: true
    }
  }),
  /trusted retrieval/
);
assert.throws(
  () => planWithStructuredMemory({
    planner: {},
    goal: 'graph',
    memoryContext: context
  }),
  /trusted agent planner/
);
assert.throws(
  () => planWithStructuredMemory({
    planner: Object.create(Object.getPrototypeOf(new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphFromMemory',
        timeoutMs: 2000
      })
    }))),
    goal: 'graph',
    memoryContext: context
  }),
  /trusted agent planner/
);

const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-context-boundary-planner'
});
const accessorContext = {};
Object.defineProperty(accessorContext, 'taskId', {
  enumerable: true,
  get() {
    return 'memory-context-boundary-accessor';
  }
});
assert.throws(
  () => planWithStructuredMemory({
    planner,
    goal: 'graph',
    memoryContext: context,
    context: accessorContext
  }),
  /enumerable data properties only/
);
assert.throws(
  () => planWithStructuredMemory({
    planner,
    goal: 'graph',
    memoryContext: context,
    context: (() => {
      const cyclic = {};
      cyclic.self = cyclic;
      return cyclic;
    })()
  }),
  /plain objects and arrays|must not contain cycles/
);

const plannerData = context.toPlannerData();
assert.equal(Object.isFrozen(plannerData), true);
assert.equal(Object.hasOwn(plannerData, 'actionReport'), false);
assert.equal(plannerData.authorityTransferred, false);
assert.throws(() => {
  plannerData.authorityTransferred = true;
}, TypeError);

console.log(
  `FLUID_MEMORY_PLANNER_CONTEXT_BOUNDARY_OK forgedContextRejected=true `
  + `plannerRejected=true accessorRejected=true cycleRejected=true `
  + `proofSuppressed=${Object.hasOwn(plannerData, 'actionReport') === false} `
  + `immutable=${Object.isFrozen(plannerData)}`
);
