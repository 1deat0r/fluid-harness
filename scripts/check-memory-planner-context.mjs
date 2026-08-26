import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  buildStructuredMemoryContext,
  isTrustedStructuredMemoryContext,
  memoryFromAgentRun,
  planWithStructuredMemory
} from '../src/memory.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const sourceRunner = new BoundedAgentRunner();
const history = sourceRunner.run({
  episodes: [{
    task: { id: 'memory-context-history', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }]
});
const memory = memoryFromAgentRun({
  runReport: history,
  idPrefix: 'memory-context'
});
const memoryContext = buildStructuredMemoryContext({
  memory,
  query: {
    keywords: ['graph-algorithms'],
    limit: 1
  }
});
assert.equal(isTrustedStructuredMemoryContext(memoryContext), true);
assert.equal(memoryContext.resultCount, 1);

const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemory',
    timeoutMs: 2000
  }),
  plannerId: 'memory-context-planner'
});
const plan = planWithStructuredMemory({
  planner,
  goal: 'graph',
  memoryContext,
  context: {
    taskId: 'memory-context-planned-task',
    description: 'Find a graph path'
  }
});
assert.match(plan.episodes[0].task.description, /1 historical matches/);
const plannerData = memoryContext.toPlannerData();
assert.equal(plannerData.dataOnly, true);
assert.equal(plannerData.historicalOnly, true);
assert.equal(plannerData.authorityTransferred, false);
assert.equal(Object.hasOwn(plannerData, 'actionReport'), false);
assert.equal(Object.isFrozen(plannerData), true);

const runner = new BoundedAgentRunner();
const report = runner.runPlan({ plan });
assert.equal(report.completed, true);
assert.equal(report.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.cycles[0].taskId, 'memory-context-planned-task');

console.log(
  `FLUID_MEMORY_PLANNER_CONTEXT_OK results=${memoryContext.resultCount} `
  + `planner=${plan.plannerId} historicalOnly=${plannerData.historicalOnly} `
  + `action=${report.cycles[0].action.evidence} authorityTransferred=${plannerData.authorityTransferred}`
);
