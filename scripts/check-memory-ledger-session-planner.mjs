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
  prefix: 'memory-ledger-session-planner'
});
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-session-planner-runtime'
});
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner
});
const receipt = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.SESSION,
    strategyKey: 'memory-aware-session',
    keywords: ['quorum']
  },
  context: {
    taskId: 'memory-ledger-session-planner-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-session-planner'
});

assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.memoryContext.query.source, MEMORY_SOURCES.SESSION);
assert.equal(receipt.memoryContext.resultCount, 1);
assert.match(receipt.plan.firstTaskDescription, /1 historical matches/);
assert.deepEqual(receipt.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(receipt.memoryContext.dataOnly, true);
assert.equal(receipt.memoryContext.historicalOnly, true);
assert.equal(receipt.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(receipt, 'session'), false);
assert.equal(Object.hasOwn(receipt, 'coordination'), false);

console.log(
  `FLUID_MEMORY_LEDGER_SESSION_PLANNER_OK source=${receipt.memoryContext.query.source} `
  + `memoryResults=${receipt.memoryContext.resultCount} planner=${receipt.plannerId} `
  + `action=${receipt.run.actionEvidence[0]} historicalOnly=${receipt.memoryContext.historicalOnly} `
  + `authorityTransferred=${receipt.memoryContext.authorityTransferred}`
);
