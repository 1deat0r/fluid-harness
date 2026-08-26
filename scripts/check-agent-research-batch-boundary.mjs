import assert from 'node:assert/strict';

import {
  AGENT_RESEARCH_BATCH_STATUSES,
  BoundedAgentRunner
} from '../src/agent.mjs';
import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  ResearchSchedule,
  isTrustedResearchSchedule
} from '../src/research-scheduler.mjs';
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

function goodBatchEntries() {
  return [
    {
      taskId: 'agent-research-batch-boundary-first',
      research: researchSpec('agent-research-batch-boundary-first')
    },
    {
      taskId: 'agent-research-batch-boundary-second',
      research: researchSpec('agent-research-batch-boundary-second')
    }
  ];
}

const runner = new BoundedAgentRunner();
const runReport = runner.run({
  episodes: [
    surprisingEpisode('agent-research-batch-boundary-first'),
    surprisingEpisode('agent-research-batch-boundary-second')
  ],
  stopOnResearchRequired: false
});
const schedule = runner.scheduleResearch({ maxItems: 2 });

const forgedSchedule = new ResearchSchedule({
  entries: schedule.entries,
  requestedItems: 2,
  sourceCount: 2
});
assert.equal(isTrustedResearchSchedule(forgedSchedule), false);
assert.throws(
  () => runner.resolveScheduledResearch({
    runReport,
    schedule: forgedSchedule,
    researches: goodBatchEntries()
  }),
  /trusted schedule/
);

const swapped = goodBatchEntries().reverse();
assert.throws(
  () => runner.resolveScheduledResearch({ runReport, schedule, researches: swapped }),
  /order mismatch/
);
assert.throws(
  () => runner.resolveScheduledResearch({
    runReport,
    schedule,
    researches: goodBatchEntries().slice(0, 1)
  }),
  /one research specification per selected task/
);

const accessorEntry = {
  research: researchSpec('agent-research-batch-boundary-accessor')
};
Object.defineProperty(accessorEntry, 'taskId', {
  enumerable: true,
  get() {
    return 'agent-research-batch-boundary-first';
  }
});
assert.throws(
  () => runner.resolveScheduledResearch({
    runReport,
    schedule,
    researches: [accessorEntry, goodBatchEntries()[1]]
  }),
  /only enumerable taskId and research data/
);

const extraProperty = {
  ...goodBatchEntries()[0],
  extra: true
};
assert.throws(
  () => runner.resolveScheduledResearch({
    runReport,
    schedule,
    researches: [extraProperty, goodBatchEntries()[1]]
  }),
  /only enumerable taskId and research data/
);

const incompleteRunner = new BoundedAgentRunner();
const incompleteRun = incompleteRunner.run({
  episodes: [
    surprisingEpisode('agent-research-batch-boundary-first'),
    surprisingEpisode('agent-research-batch-boundary-second')
  ],
  stopOnResearchRequired: false
});
const incompleteSchedule = incompleteRunner.scheduleResearch({ maxItems: 2 });
const incomplete = incompleteRunner.resolveScheduledResearch({
  runReport: incompleteRun,
  schedule: incompleteSchedule,
  researches: [
    {
      taskId: 'agent-research-batch-boundary-first',
      research: researchSpec('agent-research-batch-boundary-incomplete', 2, 1)
    },
    {
      taskId: 'agent-research-batch-boundary-second',
      research: researchSpec('agent-research-batch-boundary-second')
    }
  ]
});
assert.equal(incomplete.status, AGENT_RESEARCH_BATCH_STATUSES.INCOMPLETE);
assert.equal(incomplete.complete, false);
assert.equal(incomplete.attemptedCount, 1);
assert.equal(incomplete.resolvedCount, 0);
assert.equal(incomplete.pendingResearch.length, 2);
assert.equal(Object.isFrozen(incomplete), true);

const staleRunner = new BoundedAgentRunner();
const staleRun = staleRunner.run({
  episodes: [surprisingEpisode('agent-research-batch-boundary-stale')],
  stopOnResearchRequired: false
});
const staleSchedule = staleRunner.scheduleResearch({ maxItems: 1 });
staleRunner.resolveResearch({
  runReport: staleRun,
  taskId: 'agent-research-batch-boundary-stale',
  research: researchSpec('agent-research-batch-boundary-stale')
});
assert.throws(
  () => staleRunner.resolveScheduledResearch({
    runReport: staleRun,
    schedule: staleSchedule,
    researches: [{
      taskId: 'agent-research-batch-boundary-stale',
      research: researchSpec('agent-research-batch-boundary-stale-retry')
    }]
  }),
  /stale run report/
);

console.log(
  `FLUID_AGENT_RESEARCH_BATCH_BOUNDARY_OK malformedRejected=true `
  + `orderRejected=true accessorRejected=true incompleteStops=true staleRejected=true `
  + `immutable=${Object.isFrozen(incomplete)}`
);
