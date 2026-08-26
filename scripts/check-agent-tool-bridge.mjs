import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AGENT_STOP_REASONS,
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { isTrustedActionReport } from '../src/harness.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  ToolDefinition,
  ToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function definition(id, exportName) {
  return new ToolDefinition({
    id,
    description: `agent fixture ${id}`,
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: 2000
    })
  });
}

const registry = new ToolRegistry({
  tools: [
    definition('agent-graph-input', 'toolGraphInput'),
    definition('agent-tool-failure', 'toolFail')
  ]
});
const runner = new BoundedAgentRunner({ toolRegistry: registry });
const completed = runner.run({
  episodes: [{
    task: { id: 'agent-tool-bridge-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'agent-graph-input',
      callId: 'agent-tool-bridge-call',
      input: { source: 'bounded-tool' }
    }],
    inputFromToolCall: 'agent-tool-bridge-call'
  }]
});

assert.equal(isTrustedAgentRunReport(completed), true);
assert.equal(completed.completed, true);
assert.equal(completed.stopReason, AGENT_STOP_REASONS.COMPLETED);
assert.equal(completed.attemptedEpisodes, 1);
assert.equal(completed.cycles.length, 1);
assert.equal(completed.toolInvocations.length, 1);
assert.equal(completed.toolInvocations[0].status, TOOL_INVOCATION_STATUSES.COMPLETED);
assert.equal(completed.toolInvocations[0].evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(completed.toolInvocations[0].verified, false);
assert.equal(completed.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(isTrustedActionReport(completed.toolInvocations[0]), false);
assert.equal(Object.isFrozen(completed.toolInvocations), true);
assert.throws(() => {
  completed.toolInvocations[0] = null;
}, TypeError);

const failed = new BoundedAgentRunner({ toolRegistry: registry }).run({
  episodes: [{
    task: { id: 'agent-tool-failure-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'agent-tool-failure',
      callId: 'agent-tool-failure-call',
      input: null
    }],
    inputFromToolCall: 'agent-tool-failure-call'
  }]
});

assert.equal(failed.completed, false);
assert.equal(failed.stopReason, AGENT_STOP_REASONS.TOOL_FAILURE);
assert.equal(failed.attemptedEpisodes, 1);
assert.equal(failed.cycles.length, 0);
assert.equal(failed.toolInvocations.length, 1);
assert.equal(failed.toolInvocations[0].status, TOOL_INVOCATION_STATUSES.FAILED);
assert.equal(failed.coreStatus.actionsUsed, 0);
assert.equal(failed.auditValid, true);
assert.match(failed.error, /tool fixture failed/);

assert.throws(
  () => new BoundedAgentRunner({ toolRegistry: Object.create(Object.getPrototypeOf(registry)) }),
  /trusted ToolRegistry/
);

console.log(
  `FLUID_AGENT_TOOL_BRIDGE_OK completed=${completed.completed} `
  + `action=${completed.cycles[0].action.evidence} tool=${completed.toolInvocations[0].evidence} `
  + `failure=${failed.stopReason} actionsAfterFailure=${failed.coreStatus.actionsUsed} `
  + `audits=${completed.auditValid && failed.auditValid}`
);
