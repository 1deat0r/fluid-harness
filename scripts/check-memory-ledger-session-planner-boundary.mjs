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
import { buildMemoryAwareSessionLedger } from './fixtures/memory-aware-session-ledger.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const { verifiedLedger } = buildMemoryAwareSessionLedger({
  prefix: 'memory-ledger-session-planner-boundary'
});
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-session-planner-boundary-runtime'
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
    context: { taskId: 'memory-ledger-session-planner-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.SESSION;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-session-planner-accessor' }
  }),
  /only enumerable data properties/
);
const noSession = agent.run({
  goal: 'graph',
  query: { source: MEMORY_SOURCES.COORDINATION },
  context: {
    taskId: 'memory-ledger-session-planner-no-match',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-session-planner-no-match'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(noSession), true);
assert.equal(noSession.memoryContext.resultCount, 0);
assert.deepEqual(noSession.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(noSession.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(noSession.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(noSession, 'session'), false);

console.log(
  `FLUID_MEMORY_LEDGER_SESSION_PLANNER_BOUNDARY_OK forgedLedgerRejected=true `
  + `invalidSourceRejected=true accessorRejected=true noMatch=${noSession.memoryContext.resultCount} `
  + `freshProof=${noSession.run.actionEvidence[0]} authoritySuppressed=`
  + `${noSession.memoryContext.authorityTransferred === false}`
);
