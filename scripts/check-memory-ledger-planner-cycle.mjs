import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner, isTrustedAgentRunReport } from '../src/agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  planWithStructuredMemory
} from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const originalRunner = new BoundedAgentRunner();
const originalReport = originalRunner.run({
  episodes: [{
    task: { id: 'memory-ledger-cycle-history', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(originalReport);
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restoredRuns = restoredLedger.restoreAgentRuns();
const memory = memoryFromLedger({
  ledger: restoredLedger,
  idPrefix: 'memory-ledger-cycle'
});
const context = buildStructuredMemoryContext({
  memory,
  query: { keywords: ['graph-algorithms'], limit: 1 }
});
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-ledger-cycle-planner'
});
const plan = planWithStructuredMemory({
  planner,
  goal: 'graph',
  memoryContext: context,
  context: {
    taskId: 'memory-ledger-cycle-next-task',
    description: 'Find a graph path'
  }
});
const freshRunner = new BoundedAgentRunner();
const freshReport = freshRunner.runPlan({ plan });

assert.equal(isTrustedAgentRunReport(restoredRuns[0]), false);
assert.match(plan.episodes[0].task.description, /1 historical matches/);
assert.equal(freshReport.completed, true);
assert.equal(freshReport.cycles[0].action.evidence, 'PROVEN');
assert.equal(freshReport.cycles[0].taskId, 'memory-ledger-cycle-next-task');
assert.equal(freshReport.cycles[0].action.input.source, 'process-planner-memory');
assert.equal(freshReport.cycles[0].coreStatus.actionsUsed, 1);

console.log(
  `FLUID_MEMORY_LEDGER_PLANNER_OK restoredRuns=${restoredRuns.length} `
  + `memoryEntries=${memory.size} plannerResults=${context.resultCount} `
  + `restoredRunTrusted=${isTrustedAgentRunReport(restoredRuns[0])} `
  + `action=${freshReport.cycles[0].action.evidence} freshActions=${freshReport.cycles[0].coreStatus.actionsUsed}`
);
