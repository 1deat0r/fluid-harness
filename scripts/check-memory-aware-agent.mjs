import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';
import {
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromLedger
} from '../src/memory-agent.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { ToolDefinition, ToolRegistry } from '../src/tool.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));
function graphToolRegistry(description) {
  return new ToolRegistry({
    tools: [new ToolDefinition({
      id: 'memory-aware-tool',
      description,
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'toolGraphInput',
        timeoutMs: 2000
      })
    })]
  });
}

const sourcePolicy = new AgentPolicy({ maxEpisodes: 4, maxToolCallsPerEpisode: 2 });
const sourceRunner = new BoundedAgentRunner({
  toolRegistry: graphToolRegistry('memory-aware-source-tool'),
  policy: sourcePolicy
});
const sourceReport = sourceRunner.run({
  plannerId: 'memory-aware-source-planner',
  episodes: [{
    task: { id: 'memory-aware-history', description: 'Find a graph path' },
    toolCalls: [{
      toolId: 'memory-aware-tool',
      callId: 'memory-aware-source-call',
      input: { source: 'memory-aware-source' }
    }],
    inputFromToolCall: 'memory-aware-source-call'
  }]
});
const ledger = new EvidenceLedger();
ledger.appendAgentRun(sourceReport);
const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const planner = new ProcessBackedAgentPlanner({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'planGraphFromMemoryWithTool',
    timeoutMs: 2000
  }),
  plannerId: 'memory-aware-planner'
});
const agent = memoryAwareAgentFromLedger({
  ledger: restoredLedger,
  planner,
  toolRegistry: graphToolRegistry('memory-aware-fresh-tool'),
  idPrefix: 'memory-aware'
});
assert.equal(agent.runner.policy.maxEpisodes, sourcePolicy.maxEpisodes);
assert.notEqual(agent.runner.policy, sourcePolicy);
const receipt = agent.run({
  goal: 'graph',
  query: { keywords: ['graph-algorithms'], limit: 1 },
  context: {
    taskId: 'memory-aware-next-task',
    description: 'Find a graph path',
    callId: 'memory-aware-fresh-call'
  },
  reproduction: 'memory-aware-agent-check'
});

assert.equal(isTrustedAgentRunReport(sourceReport), true);
assert.equal(isTrustedMemoryAwareAgentRunReport(receipt), true);
assert.equal(receipt.plannerId, 'memory-aware-planner');
assert.equal(receipt.plan.episodeCount, 1);
assert.equal(receipt.plan.firstTaskId, 'memory-aware-next-task');
assert.match(receipt.plan.firstTaskDescription, /1 historical matches/);
assert.equal(receipt.memoryContext.resultCount, 1);
assert.equal(receipt.memoryContext.dataOnly, true);
assert.equal(receipt.memoryContext.historicalOnly, true);
assert.equal(receipt.memoryContext.authorityTransferred, false);
assert.equal(receipt.run.completed, true);
assert.equal(receipt.run.auditValid, true);
assert.equal(receipt.run.priorWorldModelHistoryLength, 1);
assert.equal(receipt.run.toolInvocationCount, 1);
assert.deepEqual(receipt.run.toolInvocationEvidence, ['OBSERVED']);
assert.deepEqual(receipt.run.actionEvidence, ['PROVEN']);
assert.equal(receipt.run.actionsUsed, 1);
assert.equal(receipt.dataOnly, true);
assert.equal(receipt.authorityTransferred, false);
assert.equal(Object.hasOwn(receipt, 'actionReport'), false);
assert.equal(Object.hasOwn(receipt.run, 'actionReport'), false);
assert.equal(Object.isFrozen(receipt), true);
assert.equal(Object.isFrozen(receipt.plan), true);
assert.equal(Object.isFrozen(receipt.memoryContext), true);
assert.equal(Object.isFrozen(receipt.run), true);

console.log(
  `FLUID_MEMORY_AWARE_AGENT_OK planner=${receipt.plannerId} `
  + `memoryResults=${receipt.memoryContext.resultCount} actions=${receipt.run.actionsUsed} `
  + `proof=${receipt.run.actionEvidence[0]} fresh=true `
  + `worldModelHistory=${receipt.run.priorWorldModelHistoryLength} `
  + `tools=${receipt.run.toolInvocationCount} toolEvidence=${receipt.run.toolInvocationEvidence[0]} `
  + `restoredPolicy=${agent.runner.policy.maxEpisodes} `
  + `authorityTransferred=${receipt.authorityTransferred}`
);
