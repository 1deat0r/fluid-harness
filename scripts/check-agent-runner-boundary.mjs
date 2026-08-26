import assert from 'node:assert/strict';

import {
  AGENT_STOP_REASONS,
  BoundedAgentRunner,
  isTrustedAgentRunReport
} from '../src/agent.mjs';

function successEpisode(id) {
  return {
    task: { id, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  };
}

function surprisingEpisode(id) {
  return {
    task: { id, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [],
      start: 'A',
      goal: 'B'
    }
  };
}

const bounded = new BoundedAgentRunner();
const stopped = bounded.run({
  episodes: [
    successEpisode('agent-boundary-success'),
    surprisingEpisode('agent-boundary-surprise'),
    successEpisode('agent-boundary-not-run')
  ]
});

assert.equal(isTrustedAgentRunReport(stopped), true);
assert.equal(stopped.completed, false);
assert.equal(stopped.stopReason, AGENT_STOP_REASONS.RESEARCH_REQUIRED);
assert.equal(stopped.attemptedEpisodes, 2);
assert.equal(stopped.cycles.length, 2);
assert.equal(stopped.pendingResearch.length, 1);
assert.equal(stopped.coreStatus.actionsUsed, 2);
assert.equal(stopped.auditValid, true);
assert.equal(Object.isFrozen(stopped.cycles), true);
assert.throws(() => {
  stopped.stopReason = AGENT_STOP_REASONS.COMPLETED;
}, TypeError);

const completed = new BoundedAgentRunner().run({
  episodes: [successEpisode('agent-boundary-completed-a'), successEpisode('agent-boundary-completed-b')]
});
assert.equal(completed.completed, true);
assert.equal(completed.stopReason, AGENT_STOP_REASONS.COMPLETED);
assert.equal(completed.attemptedEpisodes, 2);
assert.equal(completed.pendingResearch.length, 0);
assert.equal(completed.auditValid, true);

const failed = new BoundedAgentRunner().run({
  episodes: [{
    task: { id: 'agent-boundary-error', description: 'Find a graph path' },
    input: { nodes: ['A', 'A'], edges: [], start: 'A', goal: 'A' }
  }]
});
assert.equal(failed.completed, false);
assert.equal(failed.stopReason, AGENT_STOP_REASONS.ERROR);
assert.equal(typeof failed.error, 'string');
assert.equal(failed.auditValid, true);

assert.throws(
  () => new BoundedAgentRunner({ cycleRunner: Object.create(Object.getPrototypeOf(bounded.cycleRunner)) }),
  /trusted CognitiveCycleRunner/
);

console.log(
  `FLUID_AGENT_RUNNER_OK stop=${stopped.stopReason} stoppedEpisodes=${stopped.attemptedEpisodes} `
  + `completed=${completed.completed} error=${failed.stopReason} audits=${stopped.auditValid && completed.auditValid && failed.auditValid}`
);
