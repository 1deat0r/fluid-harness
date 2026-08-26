import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildResearchMemoryLedger } from './fixtures/research-memory-ledger.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const { verifiedLedger } = buildResearchMemoryLedger({
  prefix: 'memory-ledger-research-planner-boundary'
});
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-research-planner-boundary-runtime'
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
    context: { taskId: 'memory-ledger-research-invalid-source' }
  }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get() {
    return MEMORY_SOURCES.RESEARCH;
  }
});
assert.throws(
  () => agent.run({
    goal: 'graph',
    query: accessorQuery,
    context: { taskId: 'memory-ledger-research-accessor' }
  }),
  /only enumerable data properties/
);
const noResearch = agent.run({
  goal: 'graph',
  query: { source: MEMORY_SOURCES.AGENT_RUN },
  context: {
    taskId: 'memory-ledger-research-no-match',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-research-no-match'
});

assert.equal(noResearch.memoryContext.resultCount, 0);
assert.deepEqual(noResearch.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(noResearch.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(noResearch.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(noResearch, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_LEDGER_RESEARCH_PLANNER_BOUNDARY_OK forgedLedgerRejected=true `
  + `invalidSourceRejected=true accessorRejected=true noMatch=${noResearch.memoryContext.resultCount} `
  + `freshProof=${noResearch.run.actionEvidence[0]} authoritySuppressed=true`
);
