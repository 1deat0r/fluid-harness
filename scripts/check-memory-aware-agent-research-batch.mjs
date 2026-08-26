import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentResearchBatchReceipt,
  isTrustedMemoryAwareAgentResearchScheduleReceipt,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { RepresentationCandidate } from '../src/search.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function researchSpec(prefix) {
  return {
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases: [new EvaluationCase({
      id: `${prefix}-case`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const sourceReport = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'memory-aware-batch-history', description: 'Find a graph path' },
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
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planTwoGraphPathsFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-aware-batch-planner'
});
const agent = memoryAwareAgentFromLedger({
  ledger: restoredLedger,
  planner
});
const runReceipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  stopOnResearchRequired: false,
  context: {
    taskId: 'memory-aware-batch-pending',
    description: 'Find graph paths'
  },
  reproduction: 'memory-aware-agent-research-batch-check'
});
assert.equal(runReceipt.run.pendingResearch.length, 2);

const scheduleReceipt = agent.scheduleResearch({ maxItems: 2 });
assert.equal(isTrustedMemoryAwareAgentResearchScheduleReceipt(scheduleReceipt), true);
assert.equal(scheduleReceipt.sourceCount, 2);
assert.equal(scheduleReceipt.scheduledCount, 2);
assert.equal(scheduleReceipt.complete, true);
assert.equal(scheduleReceipt.taskIds.length, 2);
assert.equal(scheduleReceipt.dataOnly, true);
assert.equal(scheduleReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(scheduleReceipt, 'schedule'), false);
assert.equal(Object.isFrozen(scheduleReceipt), true);

const batchReceipt = agent.resolveResearchBatch({
  researches: scheduleReceipt.taskIds.map((taskId, index) => ({
    taskId,
    research: researchSpec(`memory-aware-batch-${index + 1}`)
  }))
});
assert.equal(isTrustedMemoryAwareAgentResearchBatchReceipt(batchReceipt), true);
assert.equal(batchReceipt.status, 'COMPLETED');
assert.equal(batchReceipt.selectedCount, 2);
assert.equal(batchReceipt.attemptedCount, 2);
assert.equal(batchReceipt.resolvedCount, 2);
assert.deepEqual(batchReceipt.taskIds, scheduleReceipt.taskIds);
assert.equal(batchReceipt.complete, true);
assert.equal(batchReceipt.pendingResearchCount, 0);
assert.equal(batchReceipt.auditValid, true);
assert.equal(batchReceipt.dataOnly, true);
assert.equal(batchReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(batchReceipt, 'schedule'), false);
assert.equal(Object.hasOwn(batchReceipt, 'resolutions'), false);
assert.equal(Object.hasOwn(batchReceipt, 'searchReport'), false);
assert.equal(Object.isFrozen(batchReceipt), true);
assert.throws(() => {
  batchReceipt.status = 'ERROR';
}, TypeError);
assert.throws(
  () => agent.resolveResearchBatch({
    researches: []
  }),
  /requires a scheduled handoff/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_RESEARCH_BATCH_OK queued=${runReceipt.run.pendingResearch.length} `
  + `scheduled=${scheduleReceipt.scheduledCount} attempted=${batchReceipt.attemptedCount} `
  + `resolved=${batchReceipt.resolvedCount} remaining=${batchReceipt.pendingResearchCount} `
  + `complete=${batchReceipt.complete} audit=${batchReceipt.auditValid}`
);
