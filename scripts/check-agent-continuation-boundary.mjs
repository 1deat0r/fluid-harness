import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import {
  continueBoundedAgentFromLedger,
  isTrustedAgentContinuation
} from '../src/agent-continuation.mjs';
import { AgentPolicy, isTrustedAgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { ToolDefinition, ToolRegistry } from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function tools(id) {
  return new ToolRegistry({
    tools: [new ToolDefinition({
      id,
      description: `Continuation tool ${id}`,
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'toolGraphInput',
        timeoutMs: 2000
      })
    })]
  });
}

const sourcePolicy = new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 });
const sourceTools = tools('continuation-source-tool');
const sourceRunner = new BoundedAgentRunner({
  toolRegistry: sourceTools,
  policy: sourcePolicy
});
const sourceReport = sourceRunner.run({
  plannerId: 'continuation-source-planner',
  episodes: [{
    task: { id: 'continuation-source-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'continuation-source-tool',
      callId: 'continuation-source-call',
      input: { source: 'continuation-source' }
    }],
    inputFromToolCall: 'continuation-source-call'
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);

const continuationTools = tools('continuation-fresh-tool');
const continuation = continueBoundedAgentFromLedger({
  ledger,
  toolRegistry: continuationTools
});
assert.equal(isTrustedAgentContinuation(continuation), true);
assert.equal(continuation.context.dataOnly, true);
assert.equal(continuation.context.priorRuns.length, 1);
assert.equal(continuation.context.priorWorldModelHistoryLength, 1);
assert.equal(continuation.context.effectivePolicy.maxEpisodes, 4);
assert.equal(isTrustedAgentPolicy(continuation.runner.policy), true);
assert.notEqual(continuation.runner.policy, sourcePolicy);
assert.equal(continuation.runner.toolRegistry, continuationTools);
assert.notEqual(continuation.runner.toolRegistry, sourceTools);
assert.equal(continuation.runner.cycleRunner.core.status.actionsUsed, 0);
assert.equal(continuation.runner.cycleRunner.core.auditTrail.length, 0);
assert.equal(isTrustedAgentRunReport(continuation.context.priorRuns[0]), false);

const continuedReport = continuation.run({
  episodes: [{
    task: { id: 'continuation-next-task', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'continuation-fresh-tool',
      callId: 'continuation-fresh-call',
      input: { source: 'continuation-next' }
    }],
    inputFromToolCall: 'continuation-fresh-call'
  }]
});
assert.equal(continuedReport.completed, true);
assert.equal(continuedReport.cycles.length, 1);
assert.equal(continuedReport.cycles[0].action.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(continuedReport.cycles[0].action.priorStrategyProfile.attempts, 1);
assert.equal(continuation.runner.cycleRunner.core.status.actionsUsed, 1);
assert.equal(sourceRunner.cycleRunner.core.status.actionsUsed, 1);

console.log(
  `FLUID_AGENT_CONTINUATION_OK trusted=${isTrustedAgentContinuation(continuation)} `
  + `history=${continuation.context.priorWorldModelHistoryLength} `
  + `freshActions=${continuation.runner.cycleRunner.core.status.actionsUsed} `
  + `freshProof=${continuedReport.cycles[0].action.evidence} authorityReset=true`
);
