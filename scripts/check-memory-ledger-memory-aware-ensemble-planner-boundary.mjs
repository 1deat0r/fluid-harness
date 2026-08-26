import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildMemoryAwareAdversarialEnsemble } from './fixtures/memory-aware-adversarial-ensemble.mjs';

const { ledger, report } = buildMemoryAwareAdversarialEnsemble({
  prefix: 'memory-ledger-memory-aware-ensemble-planner-boundary'
});
ledger.appendMemoryAwareAgentEnsemble(report);
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

assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: {},
    planner: createPlanner('memory-ledger-memory-aware-ensemble-forged-ledger')
  }),
  /trusted evidence ledger/
);
const agent = memoryAwareAgentFromLedger({
  ledger,
  planner: createPlanner('memory-ledger-memory-aware-ensemble-boundary-runtime')
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-memory-aware-ensemble-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.ENSEMBLE;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-memory-aware-ensemble-accessor' }
  }),
  /only enumerable data properties/
);
const sourceMismatch = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.COORDINATION,
    strategyKey: 'memory-aware-agent-ensemble'
  },
  context: {
    taskId: 'memory-ledger-memory-aware-ensemble-source-mismatch',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-memory-aware-ensemble-source-mismatch'
});
assert.equal(sourceMismatch.memoryContext.resultCount, 0);
assert.deepEqual(sourceMismatch.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(sourceMismatch.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(sourceMismatch.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(sourceMismatch, 'actionReport'), false);

const tampered = JSON.parse(ledger.serialize());
tampered.records[1].payload.quorum = 1;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /inconsistent|hash verification failed/
);

console.log(
  `FLUID_MEMORY_LEDGER_MEMORY_AWARE_ENSEMBLE_PLANNER_BOUNDARY_OK `
  + `forgedLedgerRejected=true invalidSourceRejected=true accessorRejected=true `
  + `sourceMismatch=${sourceMismatch.memoryContext.resultCount} freshProof=${sourceMismatch.run.actionEvidence[0]} `
  + `tamperedRejected=true artifactExposureRejected=true authoritySuppressed=true`
);
