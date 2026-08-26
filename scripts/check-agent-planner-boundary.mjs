import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { isTrustedActionReport } from '../src/harness.mjs';
import {
  AGENT_PLAN_SOURCES,
  ProcessBackedAgentPlanner,
  isTrustedAgentEpisodePlan,
  isTrustedAgentPlanner
} from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function planner(exportName, options = {}) {
  return new ProcessBackedAgentPlanner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: 2000
    }),
    plannerId: options.plannerId ?? `planner-${exportName}`,
    maxEpisodes: options.maxEpisodes ?? 4,
    maxToolCallsPerEpisode: options.maxToolCallsPerEpisode ?? 2
  });
}

const validPlanner = planner('planGraph');
const plan = validPlanner.plan({
  goal: 'graph',
  context: { callId: 'planner-boundary-call' }
});
assert.equal(isTrustedAgentPlanner(validPlanner), true);
assert.equal(isTrustedAgentEpisodePlan(plan), true);
assert.equal(plan.source, AGENT_PLAN_SOURCES.PROCESS_ISOLATED);
assert.equal(plan.dataOnly, true);
assert.equal(plan.episodes.length, 1);
assert.equal(plan.episodes[0].task.description, 'Find a graph path');
assert.equal(plan.episodes[0].toolCalls.length, 1);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.episodes), true);
assert.equal(Object.isFrozen(plan.episodes[0]), true);
assert.equal(Object.isFrozen(plan.episodes[0].toolCalls), true);
assert.equal(isTrustedActionReport(plan), false);
assert.throws(() => {
  plan.episodes[0].task.description = 'forged';
}, TypeError);

assert.throws(
  () => planner('planMissingDescription').plan({ goal: 'invalid' }),
  /task\.description/
);
assert.throws(
  () => planner('planMany', { maxEpisodes: 2 }).plan({ goal: 'too-many' }),
  /maximum is 2/
);
assert.throws(
  () => validPlanner.plan({ goal: '   ' }),
  /Agent planner goal/
);
assert.throws(
  () => new ProcessBackedAgentPlanner({
    runner: Object.create(Object.getPrototypeOf(validPlanner.runner))
  }),
  /trusted ProcessIsolatedRunner/
);

console.log(
  `FLUID_AGENT_PLANNER_BOUNDARY_OK source=${plan.source} episodes=${plan.episodes.length} `
  + `dataOnly=${plan.dataOnly} malformedRejected=true oversizedRejected=true frozen=true`
);
