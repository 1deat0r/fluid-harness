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

const evaluationCase = new EvaluationCase({
  id: 'memory-ledger-adversarial-planner-boundary-case',
  domain: 'graph',
  adversarial: true,
  task: {
    id: 'memory-ledger-adversarial-planner-boundary-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
});
const lineage = new AdversarialLineageRunner({
  lineageId: 'memory-ledger-adversarial-planner-boundary-lineage'
}).run({
  candidateId: 'memory-ledger-adversarial-planner-boundary-kernel',
  cases: [evaluationCase]
});
const ledger = new EvidenceLedger();
ledger.appendAdversarialLineage(lineage);
const serialized = ledger.serialize();
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-adversarial-planner-boundary-runtime'
});

assert.throws(
  () => memoryAwareAgentFromLedger({ ledger: {}, planner }),
  /trusted evidence ledger/
);
const agent = memoryAwareAgentFromLedger({ ledger, planner });
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-adversarial-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ADVERSARIAL_LINEAGE;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-adversarial-accessor' }
  }),
  /only enumerable data properties/
);
const noMatch = agent.run({
  goal: 'graph',
  query: { source: MEMORY_SOURCES.SESSION },
  context: {
    taskId: 'memory-ledger-adversarial-no-match',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-adversarial-no-match'
});
assert.equal(noMatch.memoryContext.resultCount, 0);
assert.deepEqual(noMatch.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(noMatch.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(noMatch.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(noMatch, 'actionReport'), false);

const tampered = JSON.parse(serialized);
tampered.records[0].payload.successes = 0;
assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
    planner: new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphFromMemory',
        timeoutMs: 2000
      }),
      plannerId: 'memory-ledger-adversarial-tampered-runtime'
    })
  }),
  /inconsistent|hash verification failed/
);

console.log(
  `FLUID_MEMORY_LEDGER_ADVERSARIAL_LINEAGE_PLANNER_BOUNDARY_OK `
  + `forgedLedgerRejected=true invalidSourceRejected=true accessorRejected=true `
  + `noMatch=${noMatch.memoryContext.resultCount} freshProof=${noMatch.run.actionEvidence[0]} `
  + `tamperedRejected=true authoritySuppressed=true`
);
