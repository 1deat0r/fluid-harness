import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner,
  isTrustedAgentRunReport,
  isTrustedAgentRunner
} from '../src/agent.mjs';
import {
  AgentPolicy,
  isTrustedAgentPolicy
} from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedActionReport
} from '../src/harness.mjs';
import {
  isTrustedCycleReport
} from '../src/cycle.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  isTrustedToolInvocationReport,
  ToolDefinition,
  ToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const tools = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'agent-ledger-restore-tool',
    description: 'Builds graph input for restore checks',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolGraphInput',
      timeoutMs: 2000
    })
  })]
});
const policy = new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 });
const runner = new BoundedAgentRunner({ toolRegistry: tools, policy });
const report = runner.run({
  plannerId: 'ledger-restore-planner',
  episodes: [{
    task: { id: 'agent-ledger-restore-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'agent-ledger-restore-tool',
      callId: 'agent-ledger-restore-call',
      input: { source: 'ledger-restore' }
    }],
    inputFromToolCall: 'agent-ledger-restore-call'
  }]
});

const ledger = new EvidenceLedger();
ledger.appendAgentRun(report);
const restored = EvidenceLedger.fromSerialized(ledger.serialize());
const runs = restored.restoreAgentRuns();
const run = runs[0];

assert.equal(Object.isFrozen(runs), true);
assert.equal(Object.isFrozen(run), true);
assert.equal(Object.isFrozen(run.cycles), true);
assert.equal(Object.isFrozen(run.toolInvocations), true);
assert.equal(Object.isFrozen(run.policy), true);
assert.equal(Object.isFrozen(run.cycles[0]), true);
assert.equal(Object.isFrozen(run.toolInvocations[0]), true);
assert.throws(() => {
  run.stopReason = 'ERROR';
}, TypeError);
assert.throws(() => {
  run.policy.maxEpisodes = 1;
}, TypeError);

assert.equal(isTrustedAgentRunReport(run), false);
assert.equal(isTrustedAgentRunner(run), false);
assert.equal(isTrustedAgentPolicy(run.policy), false);
assert.equal(isTrustedCycleReport(run.cycles[0]), false);
assert.equal(isTrustedActionReport(run.cycles[0].action), false);
assert.equal(isTrustedToolInvocationReport(run.toolInvocations[0]), false);
const restoredModel = restored.restoreWorldModel();
assert.equal(restoredModel.history.length, 1);

console.log(
  `FLUID_AGENT_RUN_LEDGER_RESTORE_OK runs=${runs.length} frozen=${Object.isFrozen(run)} `
  + `trustedRun=${isTrustedAgentRunReport(run)} trustedAction=${isTrustedActionReport(run.cycles[0].action)} `
  + `trustedTool=${isTrustedToolInvocationReport(run.toolInvocations[0])} history=${restoredModel.history.length}`
);
