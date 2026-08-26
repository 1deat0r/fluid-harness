import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { memoryAwareAgentFromLedger } from '../src/memory-agent.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'memory-ledger-distribution-shift-planner'
});
const ledger = new EvidenceLedger();
const record = ledger.appendDistributionShift(report);
const verifiedLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromDistributionShiftMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-distribution-shift-planner-runtime'
});
const agent = memoryAwareAgentFromLedger({
  ledger: verifiedLedger,
  planner
});
const receipt = agent.run({
  goal: 'graph',
  query: {
    source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
    strategyKey: 'distribution-shift',
    keywords: ['distribution-shift', 'weakness-exposed']
  },
  context: {
    taskId: 'memory-ledger-distribution-shift-next-task',
    description: 'Find a graph path'
  },
  reproduction: 'memory-ledger-distribution-shift-planner'
});

assert.equal(receipt.memoryContext.query.source, MEMORY_SOURCES.DISTRIBUTION_SHIFT);
assert.equal(receipt.memoryContext.query.strategyKey, 'distribution-shift');
assert.equal(receipt.memoryContext.resultCount, 1);
assert.match(receipt.plan.firstTaskDescription, /weakness-exposed distribution-shift evidence/);
assert.match(receipt.plan.firstTaskDescription, /1 historical matches/);
assert.deepEqual(receipt.run.actionEvidence, [EVIDENCE_LEVELS.PROVEN]);
assert.equal(receipt.run.priorWorldModelHistoryLength, 0);
assert.equal(receipt.memoryContext.dataOnly, true);
assert.equal(receipt.memoryContext.historicalOnly, true);
assert.equal(receipt.memoryContext.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt.memoryContext, 'results'), false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);

console.log(
  `FLUID_MEMORY_LEDGER_DISTRIBUTION_SHIFT_PLANNER_OK `
  + `source=${receipt.memoryContext.query.source} strategy=${receipt.memoryContext.query.strategyKey} `
  + `memoryResults=${receipt.memoryContext.resultCount} planner=${receipt.plannerId} `
  + `action=${receipt.run.actionEvidence[0]} archive=${record.kind}:${record.sequence} `
  + `historicalOnly=${receipt.memoryContext.historicalOnly} `
  + `authorityTransferred=${receipt.memoryContext.authorityTransferred}`
);
