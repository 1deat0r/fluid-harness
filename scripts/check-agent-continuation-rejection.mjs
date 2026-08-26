import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { BoundedAgentRunner } from '../src/agent.mjs';
import {
  continueBoundedAgentFromLedger,
  isTrustedAgentContinuation
} from '../src/agent-continuation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { ToolDefinition, ToolRegistry } from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
const registry = new ToolRegistry({
  tools: [new ToolDefinition({
    id: 'continuation-rejection-tool',
    description: 'Builds graph input for continuation rejection checks',
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName: 'toolGraphInput',
      timeoutMs: 2000
    })
  })]
});
const sourceReport = new BoundedAgentRunner({ toolRegistry: registry }).run({
  episodes: [{
    task: { id: 'continuation-rejection-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'continuation-rejection-tool',
      callId: 'continuation-rejection-call',
      input: { source: 'rejection' }
    }],
    inputFromToolCall: 'continuation-rejection-call'
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);
const serialized = ledger.serialize();

assert.throws(
  () => continueBoundedAgentFromLedger({
    ledger: Object.create(Object.getPrototypeOf(ledger))
  }),
  /trusted EvidenceLedger/
);
assert.throws(
  () => continueBoundedAgentFromLedger({
    ledger,
    policy: { maxEpisodes: 2, maxToolCallsPerEpisode: 1, dataOnly: true }
  }),
  /explicit policy must be trusted/
);

const tampered = JSON.parse(serialized);
tampered.records[0].payload.plannerId = 'tampered-planner';
assert.throws(
  () => continueBoundedAgentFromLedger({
    ledger: EvidenceLedger.fromSerialized(JSON.stringify(tampered))
  }),
  /hash verification failed/
);

const spoofed = Object.create(Object.getPrototypeOf(ledger));
assert.equal(isTrustedAgentContinuation(spoofed), false);
assert.throws(
  () => new AgentPolicy({ maxEpisodes: 0 }),
  /from 1 through 32/
);

console.log(
  `FLUID_AGENT_CONTINUATION_REJECTION_OK untrustedLedger=true `
  + `plainPolicyRejected=true tamperRejected=true spoofedContinuation=${isTrustedAgentContinuation(spoofed)}`
);
