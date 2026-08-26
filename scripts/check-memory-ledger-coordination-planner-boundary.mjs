import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildMemoryAwareCoordinationLedger } from './fixtures/memory-aware-coordination-ledger.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const { verifiedLedger } = buildMemoryAwareCoordinationLedger({
  prefix: 'memory-ledger-coordination-planner-boundary'
});
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-coordination-planner-boundary-runtime'
});

assert.throws(
  () => memoryAwareAgentFromLedger({ ledger: {}, planner }),
  /trusted evidence ledger/
);
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: { source: 'FORGED' },
    context: { taskId: 'memory-ledger-coordination-planner-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.COORDINATION;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-coordination-planner-accessor' }
  }),
  /only enumerable data properties/
);
const noCoordination = agent.run({
  goal: 'graph',
  query: { source: MEMORY_SOURCES.SESSION },
  context: {
    taskId: 'memory-ledger-coordination-planner-no-match',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-coordination-planner-no-match'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(noCoordination), true);
assert.equal(noCoordination.memoryContext.resultCount, 0);
assert.deepEqual(noCoordination.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(noCoordination.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(noCoordination.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(noCoordination, 'peerMessages'), false);
assert.equal(Object.hasOwn(noCoordination, 'rounds'), false);

console.log(
  `FLUID_MEMORY_LEDGER_COORDINATION_PLANNER_BOUNDARY_OK forgedLedgerRejected=true `
  + `invalidSourceRejected=true accessorRejected=true noMatch=${noCoordination.memoryContext.resultCount} `
  + `freshProof=${noCoordination.run.actionEvidence[0]} authoritySuppressed=`
  + `${noCoordination.memoryContext.authorityTransferred === false}`
);
