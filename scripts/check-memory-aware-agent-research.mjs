import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentResearchReceipt,
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
    task: { id: 'memory-aware-research-history', description: 'Find a graph path' },
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
    exportName: 'planGraphFromMemoryNoPath',
    timeoutMs: 2000
  }),
  plannerId: 'memory-aware-research-planner'
});
const agent = memoryAwareAgentFromLedger({
  ledger: restoredLedger,
  planner
});
const runReceipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-research-pending',
    description: 'Find a graph path'
  },
  reproduction: 'memory-aware-agent-research-check'
});

assert.equal(isTrustedAgentRunReport(sourceReport), true);
assert.equal(runReceipt.run.completed, false);
assert.equal(runReceipt.run.stopReason, 'RESEARCH_REQUIRED');
assert.equal(runReceipt.run.pendingResearch.length, 1);
assert.deepEqual(runReceipt.run.actionEvidence, ['PROVEN']);

const resolutionReceipt = agent.resolveResearch({
  research: researchSpec('memory-aware-research-complete')
});
assert.equal(isTrustedMemoryAwareAgentResearchReceipt(resolutionReceipt), true);
assert.equal(resolutionReceipt.status, 'RESOLVED');
assert.equal(resolutionReceipt.taskId, 'memory-aware-research-pending');
assert.equal(resolutionReceipt.search.complete, true);
assert.equal(resolutionReceipt.search.allAuditsValid, true);
assert.equal(resolutionReceipt.pendingResearchCount, 0);
assert.equal(resolutionReceipt.auditValid, true);
assert.equal(resolutionReceipt.dataOnly, true);
assert.equal(resolutionReceipt.authorityTransferred, false);
assert.equal(Object.hasOwn(resolutionReceipt, 'searchReport'), false);
assert.equal(Object.hasOwn(resolutionReceipt, 'actionReport'), false);
assert.equal(Object.isFrozen(resolutionReceipt), true);
assert.equal(Object.isFrozen(resolutionReceipt.search), true);
assert.throws(() => {
  resolutionReceipt.status = 'ERROR';
}, TypeError);
assert.throws(
  () => agent.run({ goal: 'graph' }),
  /fresh active bounded runner/
);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_RESEARCH_OK pending=${runReceipt.run.pendingResearch.length} `
  + `status=${resolutionReceipt.status} remaining=${resolutionReceipt.pendingResearchCount} `
  + `audit=${resolutionReceipt.auditValid} proof=${runReceipt.run.actionEvidence[0]} `
  + `authorityTransferred=${resolutionReceipt.authorityTransferred}`
);
