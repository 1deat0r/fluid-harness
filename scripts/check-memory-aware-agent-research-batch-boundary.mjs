import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  MemoryAwareAgentResearchBatchReceipt,
  MemoryAwareAgentResearchScheduleReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { RepresentationCandidate } from '../src/search.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function researchSpec(prefix, caseCount = 1, maxCases = caseCount) {
  const cases = [];
  for (let index = 0; index < caseCount; index += 1) {
    cases.push(new EvaluationCase({
      id: `${prefix}-case-${index + 1}`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task-${index + 1}`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }));
  }
  return {
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases,
    productionBudget: new EvaluationBudget({ maxCases }),
    researchBudget: new EvaluationBudget({ maxCases }),
    skepticBudget: new EvaluationBudget({ maxCases })
  };
}

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-batch-boundary-history', description: 'Find a graph path' },
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

function makeAgent(plannerId) {
  return memoryAwareAgentFromLedger({
    ledger: restoredLedger,
    planner: new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planTwoGraphPathsFromMemory',
        timeoutMs: 2000
      }),
      plannerId
    })
  });
}

const beforeRun = makeAgent('memory-aware-batch-before-run');
assert.throws(
  () => beforeRun.scheduleResearch({ maxItems: 2 }),
  /requires a prior bounded run/
);

const agent = makeAgent('memory-aware-batch-boundary');
agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  stopOnResearchRequired: false,
  context: { taskId: 'memory-aware-batch-boundary-task' }
});

const accessorScheduleOptions = {};
Object.defineProperty(accessorScheduleOptions, 'maxItems', {
  enumerable: true,
  get() {
    return 2;
  }
});
assert.throws(
  () => agent.scheduleResearch(accessorScheduleOptions),
  /only enumerable data properties/
);
const schedule = agent.scheduleResearch({ maxItems: 2 });
assert.throws(
  () => agent.resolveResearchBatch({
    schedule: {},
    researches: []
  }),
  /only enumerable data properties/
);
assert.throws(
  () => agent.resolveResearchBatch({
    researches: [
      { taskId: schedule.taskIds[1], research: researchSpec('memory-aware-order-second') },
      { taskId: schedule.taskIds[0], research: researchSpec('memory-aware-order-first') }
    ]
  }),
  /order mismatch/
);
assert.throws(
  () => new MemoryAwareAgentResearchScheduleReceipt({ schedule: {} }),
  /trusted schedule/
);
assert.throws(
  () => new MemoryAwareAgentResearchBatchReceipt({ batch: {} }),
  /trusted batch resolution/
);

const accessorBatchOptions = {
  researches: schedule.taskIds.map((taskId, index) => ({
    taskId,
    research: researchSpec(`memory-aware-accessor-batch-${index + 1}`)
  }))
};
Object.defineProperty(accessorBatchOptions, 'maxItems', {
  enumerable: true,
  get() {
    return 2;
  }
});
assert.throws(
  () => agent.resolveResearchBatch(accessorBatchOptions),
  /only enumerable data properties/
);

const incomplete = agent.resolveResearchBatch({
  researches: [
    {
      taskId: schedule.taskIds[0],
      research: researchSpec('memory-aware-batch-incomplete', 2, 1)
    },
    {
      taskId: schedule.taskIds[1],
      research: researchSpec('memory-aware-batch-not-attempted')
    }
  ]
});
assert.equal(incomplete.status, 'INCOMPLETE');
assert.equal(incomplete.attemptedCount, 1);
assert.equal(incomplete.resolvedCount, 0);
assert.equal(incomplete.pendingResearchCount, 2);

const retried = agent.resolveResearchBatch({
  researches: [
    {
      taskId: schedule.taskIds[0],
      research: researchSpec('memory-aware-batch-retry-first')
    },
    {
      taskId: schedule.taskIds[1],
      research: researchSpec('memory-aware-batch-retry-second')
    }
  ]
});
assert.equal(retried.status, 'COMPLETED');
assert.equal(retried.complete, true);
assert.equal(retried.attemptedCount, 2);
assert.equal(retried.resolvedCount, 2);
assert.equal(retried.pendingResearchCount, 0);
assert.equal(retried.authorityTransferred, false);
assert.equal(Object.hasOwn(retried, 'resolutions'), false);
assert.equal(Object.hasOwn(retried, 'schedule'), false);
assert.equal(Object.hasOwn(retried, 'actionReport'), false);
assert.equal(Object.isFrozen(retried), true);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_RESEARCH_BATCH_BOUNDARY_OK priorRunRejected=true `
  + `accessorRejected=true orderRejected=true forgedScheduleRejected=true `
  + `incompleteStops=${incomplete.attemptedCount === 1} retryComplete=${retried.complete} `
  + `proofSuppressed=${Object.hasOwn(retried, 'actionReport') === false} `
  + `immutable=${Object.isFrozen(retried)}`
);
