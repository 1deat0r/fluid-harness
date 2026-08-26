import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner
} from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';
import {
  ProcessBackedAgentPlanner
} from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  ToolDefinition,
  ToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraph',
    timeoutMs: 2000
  }),
  plannerId: 'planner-execution'
});
const tools = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'planner-graph-tool',
    description: 'Builds graph input for the planned episode',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolGraphInput',
      timeoutMs: 2000
    })
  })]
});
const runner = new BoundedAgentRunner({ toolRegistry: tools });
const plan = planner.plan({
  goal: 'graph',
  context: { callId: 'planner-execution-call' }
});
const report = runner.runPlan({ plan });

assert.equal(report.plannerId, 'planner-execution');
assert.equal(report.completed, true);
assert.equal(report.cycles.length, 1);
assert.equal(report.toolInvocations.length, 1);
assert.equal(report.toolInvocations[0].status, TOOL_INVOCATION_STATUSES.COMPLETED);
assert.equal(report.toolInvocations[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.cycles[0].action.input.source, 'process-planner');
assert.equal(isTrustedActionReport(plan), false);
assert.equal(isTrustedActionReport(report.toolInvocations[0]), false);

assert.throws(
  () => runner.runPlan({ plan: Object.create(Object.getPrototypeOf(plan)) }),
  /trusted AgentEpisodePlan/
);

console.log(
  `FLUID_AGENT_PLANNER_EXECUTION_OK planner=${report.plannerId} `
  + `tool=${report.toolInvocations[0].evidence} action=${report.cycles[0].action.evidence} `
  + `completed=${report.completed} proofBoundary=true`
);
