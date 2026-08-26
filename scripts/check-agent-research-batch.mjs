import assert from 'node:assert/strict';

import {
  AGENT_RESEARCH_BATCH_STATUSES,
  BoundedAgentRunner,
  isTrustedAgentResearchBatchResolutionReport
} from '../src/agent.mjs';
import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { isTrustedResearchSchedule } from '../src/research-scheduler.mjs';
import { RepresentationCandidate } from '../src/search.mjs';

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

function researchSpec(prefix) {
  return {
    candidates: [new RepresentationCandidate({
      id: `${prefix}-candidate`,
      selectorFactory: () => new HeuristicRepresentationSelector()
    })],
    cases: [new EvaluationCase({
      id: `${prefix}-case`,
      domain: 'graph',
      adversarial: true,
      task: { id: `${prefix}-task`, description: 'Find a graph path' },
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B'
      },
      expected: (report) => report.result.path.join('>') === 'A>B'
    })],
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const runner = new BoundedAgentRunner();
const runReport = runner.run({
  episodes: [
    surprisingEpisode('agent-research-batch-first'),
    surprisingEpisode('agent-research-batch-second')
  ],
  stopOnResearchRequired: false
});
const schedule = runner.scheduleResearch({ maxItems: 2 });
assert.equal(isTrustedResearchSchedule(schedule), true);

const batch = runner.resolveScheduledResearch({
  runReport,
  schedule,
  researches: [
    {
      taskId: 'agent-research-batch-first',
      research: researchSpec('agent-research-batch-first')
    },
    {
      taskId: 'agent-research-batch-second',
      research: researchSpec('agent-research-batch-second')
    }
  ]
});

assert.equal(isTrustedAgentResearchBatchResolutionReport(batch), true);
assert.equal(batch.status, AGENT_RESEARCH_BATCH_STATUSES.COMPLETED);
assert.equal(batch.complete, true);
assert.equal(batch.selectedCount, 2);
assert.equal(batch.attemptedCount, 2);
assert.equal(batch.resolvedCount, 2);
assert.deepEqual(batch.taskIds, [
  'agent-research-batch-first',
  'agent-research-batch-second'
]);
assert.equal(batch.pendingResearch.length, 0);
assert.equal(batch.auditValid, true);
assert.equal(batch.schedule, schedule);
assert.equal(Object.isFrozen(batch), true);
assert.equal(Object.isFrozen(batch.resolutions), true);

console.log(
  `FLUID_AGENT_RESEARCH_BATCH_OK selected=${batch.selectedCount} `
  + `attempted=${batch.attemptedCount} resolved=${batch.resolvedCount} `
  + `remaining=${batch.pendingResearch.length} complete=${batch.complete} audit=${batch.auditValid}`
);
