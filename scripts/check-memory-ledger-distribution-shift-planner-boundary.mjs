import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'memory-ledger-distribution-shift-planner-boundary'
});
const ledger = new EvidenceLedger();
ledger.appendDistributionShift(report);
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
function createPlanner(plannerId) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'planGraphFromDistributionShiftMemory',
      timeoutMs: 2000
    }),
    plannerId
  });
}

assert.throws(
  () => memoryAwareAgentFromLedger({
    ledger: {},
    planner: createPlanner('memory-ledger-distribution-shift-forged-ledger')
  }),
  /trusted evidence ledger/
);
const agent = memoryAwareAgentFromLedger({
  ledger,
  planner: createPlanner('memory-ledger-distribution-shift-boundary-runtime')
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-distribution-shift-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.DISTRIBUTION_SHIFT;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-distribution-shift-accessor' }
  }),
  /only enumerable data properties/
);
const sourceMismatch = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.COORDINATION,
    strategyKey: 'distribution-shift'
  },
  context: {
    taskId: 'memory-ledger-distribution-shift-source-mismatch',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-distribution-shift-source-mismatch'
});
assert.equal(sourceMismatch.memoryContext.resultCount, 0);
assert.match(sourceMismatch.plan.firstTaskDescription, /unclassified distribution-shift evidence/);
assert.deepEqual(sourceMismatch.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(sourceMismatch.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(sourceMismatch.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(sourceMismatch, 'actionReport'), false);

const historicalMemory = memoryFromLedger({
  ledger,
  idPrefix: 'memory-ledger-distribution-shift-artifact',
  maxEntries: 8
});
const historicalEntry = historicalMemory.query({
  source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
  strategyKey: 'distribution-shift'
}).results[0];
for (const artifactKey of [
  'baseline',
  'shiftCases',
  'shiftedInputs',
  'runner',
  'harness',
  'evaluator',
  'actionReport',
  'promotionAuthority'
]) {
  assert.equal(Object.hasOwn(historicalEntry, artifactKey), false, artifactKey);
}

const serialized = JSON.parse(ledger.serialize());
const tampered = structuredClone(serialized);
tampered.records[0].payload.shiftSuccesses = 0;
assert.throws(
  () => memoryFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
    maxEntries: 8
  }),
  /hash verification failed|inconsistent/
);

console.log(
  `FLUID_MEMORY_LEDGER_DISTRIBUTION_SHIFT_PLANNER_BOUNDARY_OK `
  + `forgedLedgerRejected=true invalidSourceRejected=true accessorRejected=true `
  + `sourceMismatch=${sourceMismatch.memoryContext.resultCount} freshProof=${sourceMismatch.run.actionEvidence[0]} `
  + `tamperedRejected=true artifactExposureRejected=true authoritySuppressed=true`
);
