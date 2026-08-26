import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AdversarialLineageRunner } from '../src/adversarial-lineage.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const cases = [
  new EvaluationCase({
    id: 'memory-ledger-adversarial-planner-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'memory-ledger-adversarial-planner-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'memory-ledger-adversarial-planner-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'memory-ledger-adversarial-planner-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];
const lineage = new AdversarialLineageRunner({
  lineageId: 'memory-ledger-adversarial-planner-lineage'
}).run({
  candidateId: 'memory-ledger-adversarial-planner-kernel',
  cases
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineage(lineage);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-adversarial-planner-runtime'
});
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner
});
const receipt = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    strategyKey: 'adversarial-lineage',
    keywords: ['weakness-exposed']
  },
  context: {
    taskId: 'memory-ledger-adversarial-planner-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-adversarial-lineage-planner'
});

assert.equal(receipt.memoryContext.query.source, MEMORY_SOURCES.ADVERSARIAL_LINEAGE);
assert.equal(receipt.memoryContext.resultCount, 1);
assert.match(receipt.plan.firstTaskDescription, /1 historical matches/);
assert.deepEqual(receipt.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(receipt.memoryContext.dataOnly, true);
assert.equal(receipt.memoryContext.historicalOnly, true);
assert.equal(receipt.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_LEDGER_ADVERSARIAL_LINEAGE_PLANNER_OK `
  + `source=${receipt.memoryContext.query.source} memoryResults=${receipt.memoryContext.resultCount} `
  + `planner=${receipt.plannerId} action=${receipt.run.actionEvidence[0]} `
  + `historicalOnly=${receipt.memoryContext.historicalOnly} `
  + `authorityTransferred=${receipt.memoryContext.authorityTransferred}`
);
