import assert from 'node:assert/strict';

import {
  AGENT_RESEARCH_STATUSES,
  BoundedAgentRunner,
  isTrustedAgentResearchResolutionReport
} from '../src/agent.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate
} from '../src/search.mjs';

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

function researchSpec(prefix, caseCount = 1, maxCases = caseCount) {
  const cases = [];
  for (let index = 0; index < caseCount; index += 1) {
    cases.push(new EvaluationCase({
      id: `${prefix}-case-${index + 1}`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task-${index + 1}`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    }));
  }
  return {
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases,
    productionBudget: new EvaluationBudget({ maxCases }),
    researchBudget: new EvaluationBudget({ maxCases }),
    skepticBudget: new EvaluationBudget({ maxCases })
  };
}

const runner = new BoundedAgentRunner();
const stopped = runner.run({
  episodes: [successEpisode('agent-research-before'), surprisingEpisode('agent-research-pending')]
});
const resolved = runner.resolveResearch({
  runReport: stopped,
  research: researchSpec('agent-research-complete')
});

assert.equal(isTrustedAgentResearchResolutionReport(resolved), true);
assert.equal(resolved.status, AGENT_RESEARCH_STATUSES.RESOLVED);
assert.equal(resolved.actionNumber, 2);
assert.equal(resolved.taskId, 'agent-research-pending');
assert.equal(resolved.search.complete, true);
assert.equal(resolved.pendingResearch.length, 0);
assert.equal(resolved.auditValid, true);
assert.equal(Object.isFrozen(resolved), true);
assert.equal(Object.isFrozen(resolved.search), true);
assert.throws(() => {
  resolved.status = AGENT_RESEARCH_STATUSES.ERROR;
}, TypeError);
assert.throws(
  () => runner.resolveResearch({
    runReport: stopped,
    research: researchSpec('agent-research-replay')
  }),
  /stale run report/
);

const continuation = runner.run({
  episodes: [successEpisode('agent-research-after')]
});
assert.equal(continuation.completed, true);
assert.equal(continuation.pendingResearch.length, 0);
assert.equal(continuation.auditValid, true);

const foreignRunner = new BoundedAgentRunner();
assert.throws(
  () => foreignRunner.resolveResearch({
    runReport: stopped,
    research: researchSpec('agent-research-foreign')
  }),
  /its own run report/
);

const incompleteRunner = new BoundedAgentRunner();
const incompleteRun = incompleteRunner.run({
  episodes: [surprisingEpisode('agent-research-incomplete')]
});
const incomplete = incompleteRunner.resolveResearch({
  runReport: incompleteRun,
  research: researchSpec('agent-research-incomplete-search', 2, 1)
});
assert.equal(incomplete.status, AGENT_RESEARCH_STATUSES.INCOMPLETE);
assert.equal(incomplete.search.complete, false);
assert.equal(incomplete.pendingResearch.length, 1);
assert.equal(incomplete.auditValid, true);
const resolvedAfterRetry = incompleteRunner.resolveResearch({
  runReport: incompleteRun,
  research: researchSpec('agent-research-retry')
});
assert.equal(resolvedAfterRetry.status, AGENT_RESEARCH_STATUSES.RESOLVED);
assert.equal(resolvedAfterRetry.pendingResearch.length, 0);

const errorRunner = new BoundedAgentRunner();
const errorRun = errorRunner.run({
  episodes: [surprisingEpisode('agent-research-error')]
});
const failed = errorRunner.resolveResearch({ runReport: errorRun, research: {} });
assert.equal(failed.status, AGENT_RESEARCH_STATUSES.ERROR);
assert.match(failed.error, /requires candidates/);
assert.equal(failed.pendingResearch.length, 1);
assert.equal(failed.auditValid, true);

const shutdownRunner = new BoundedAgentRunner();
const shutdownRun = shutdownRunner.run({
  episodes: [surprisingEpisode('agent-research-shutdown')]
});
shutdownRunner.cycleRunner.core.shutdown('operator requested research pause');
const shutdown = shutdownRunner.resolveResearch({
  runReport: shutdownRun,
  research: researchSpec('agent-research-shutdown-search')
});
assert.equal(shutdown.status, AGENT_RESEARCH_STATUSES.SHUTDOWN);
assert.equal(shutdown.pendingResearch.length, 1);
assert.equal(shutdown.auditValid, true);

console.log(
  `FLUID_AGENT_RESEARCH_CONTINUATION_OK resolved=${resolved.status} `
  + `incomplete=${incomplete.status} error=${failed.status} shutdown=${shutdown.status} `
  + `continuation=${continuation.completed} audit=${resolved.auditValid && continuation.auditValid}`
);
