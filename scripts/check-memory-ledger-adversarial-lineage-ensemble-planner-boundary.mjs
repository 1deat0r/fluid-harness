import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const evaluationCases = [
  new EvaluationCase({
    id: 'memory-ledger-adversarial-ensemble-planner-boundary-success',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-ledger-adversarial-ensemble-planner-boundary-success-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'memory-ledger-adversarial-ensemble-planner-boundary-weakness',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'memory-ledger-adversarial-ensemble-planner-boundary-weakness-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];

function buildLedger() {
  const ensemble = new AdversarialLineageEnsembleRunner({
    ensembleId: 'memory-ledger-adversarial-ensemble-planner-boundary',
    maxLineages: 2
  }).run({
    candidateId: 'memory-ledger-adversarial-ensemble-planner-boundary-kernel',
    cases: evaluationCases,
    lineageCount: 2
  });
  const ledger = new EvidenceLedger();
  ledger.appendAdversarialLineageEnsemble(ensemble);
  return ledger;
}

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
function createPlanner(plannerId) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphFromMemory',
      timeoutMs: 2000
    }),
    plannerId
  });
}

const ledger = buildLedger();
assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: {},
    planner: createPlanner('memory-ledger-adversarial-ensemble-forged-ledger')
  }),
  /trusted evidence ledger/
);

const agent = memoryAwareAgentFromLedger({
  ledger,
  planner: createPlanner('memory-ledger-adversarial-ensemble-boundary-runtime')
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-adversarial-ensemble-invalid-source' }
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
    context: { taskId: 'memory-ledger-adversarial-ensemble-accessor' }
  }),
  /only enumerable data properties/
);

const strategyMismatch = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    strategyKey: 'adversarial-lineage'
  },
  context: {
    taskId: 'memory-ledger-adversarial-ensemble-strategy-mismatch',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-adversarial-ensemble-strategy-mismatch'
});
assert.equal(strategyMismatch.memoryContext.resultCount, 0);
assert.deepEqual(strategyMismatch.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(strategyMismatch.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(strategyMismatch.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(strategyMismatch, 'actionReport'), false);

const tampered = JSON.parse(ledger.serialize());
tampered.records[0].payload.lineages[0].weaknessesExposed = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /inconsistent|hash verification failed/
);

console.log(
  `FLUID_MEMORY_LEDGER_ADVERSARIAL_LINEAGE_ENSEMBLE_PLANNER_BOUNDARY_OK `
  + `forgedLedgerRejected=true invalidSourceRejected=true accessorRejected=true `
  + `strategyMismatch=${strategyMismatch.memoryContext.resultCount} freshProof=${strategyMismatch.run.actionEvidence[0]} `
  + `tamperedRejected=true artifactExposureRejected=true authoritySuppressed=true`
);
