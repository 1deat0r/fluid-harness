import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  EvidenceLedger,
  isTrustedEvidenceLedger
} from '../src/evidence-ledger.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  ToolDefinition,
  ToolRegistry
} from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const tools = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'agent-ledger-graph-tool',
    description: 'Builds graph input for the agent ledger boundary',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolGraphInput',
      timeoutMs: 2000
    })
  })]
});
const runner = new BoundedAgentRunner({
  toolRegistry: tools,
  policy: new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 })
});
const report = runner.run({
  plannerId: 'ledger-agent-planner',
  episodes: [{
    task: { id: 'agent-ledger-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'agent-ledger-graph-tool',
      callId: 'agent-ledger-tool-call',
      input: { source: 'ledger-boundary' }
    }],
    inputFromToolCall: 'agent-ledger-tool-call'
  }]
});

assert.equal(isTrustedAgentRunReport(report), true);
assert.equal(report.completed, true);
assert.equal(report.plannerId, 'ledger-agent-planner');
assert.equal(report.policy.maxEpisodes, 4);
assert.equal(report.toolInvocations.length, 1);

const ledger = new EvidenceLedger();
const entry = ledger.appendAgentRun(report);
assert.equal(isTrustedEvidenceLedger(ledger), true);
assert.equal(entry.kind, 'agent-run');
assert.equal(entry.payload.plannerId, report.plannerId);
assert.equal(entry.payload.policy.maxToolCallsPerEpisode, 2);
assert.equal(entry.payload.toolInvocations[0].evidence, 'OBSERVED');
assert.equal(entry.payload.cycles.length, 1);
assert.equal(ledger.verify(), true);

const serialized = ledger.serialize();
const restored = EvidenceLedger.fromSerialized(serialized);
assert.equal(restored.verify(), true);
assert.deepEqual(restored.serialize(), serialized);
const restoredRuns = restored.restoreAgentRuns();
assert.equal(restoredRuns.length, 1);
assert.equal(restoredRuns[0].plannerId, 'ledger-agent-planner');
assert.equal(restoredRuns[0].policy.maxEpisodes, 4);
assert.equal(restoredRuns[0].toolInvocations[0].status, 'COMPLETED');
assert.equal(isTrustedAgentRunReport(restoredRuns[0]), false);

assert.throws(
  () => ledger.appendAgentRun(Object.freeze({ ...report })),
  /trusted agent run report/
);

const tampered = JSON.parse(serialized);
tampered.records[0].payload.stopReason = 'ERROR';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)).restoreAgentRuns(),
  /hash verification failed/
);

console.log(
  `FLUID_AGENT_RUN_LEDGER_OK kind=${entry.kind} restored=${restoredRuns.length} `
  + `planner=${restoredRuns[0].plannerId} tool=${restoredRuns[0].toolInvocations.length} `
  + `trustedOriginal=${isTrustedAgentRunReport(report)} trustedRestored=${isTrustedAgentRunReport(restoredRuns[0])}`
);
