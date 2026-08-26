import assert from 'node:assert/strict';

import {
  AGENT_RESEARCH_STATUSES,
  BoundedAgentRunner,
  isTrustedAgentResearchResolutionReport
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
    surprisingEpisode('agent-research-scheduler-first'),
    surprisingEpisode('agent-research-scheduler-second')
  ],
  stopOnResearchRequired: false
});
assert.equal(runReport.pendingResearch.length, 2);

const schedule = runner.scheduleResearch({ maxItems: 1 });
assert.equal(isTrustedResearchSchedule(schedule), true);
assert.equal(schedule.entries[0].taskId, 'agent-research-scheduler-first');

const first = runner.resolveResearch({
  runReport,
  taskId: schedule.entries[0].taskId,
  research: researchSpec('agent-research-scheduler-first')
});
assert.equal(isTrustedAgentResearchResolutionReport(first), true);
assert.equal(first.status, AGENT_RESEARCH_STATUSES.RESOLVED);
assert.equal(first.pendingResearch.length, 1);

const second = runner.resolveResearch({
  runReport,
  taskId: 'agent-research-scheduler-second',
  research: researchSpec('agent-research-scheduler-second')
});
assert.equal(second.status, AGENT_RESEARCH_STATUSES.RESOLVED);
assert.equal(second.pendingResearch.length, 0);
assert.equal(second.auditValid, true);
assert.throws(
  () => runner.resolveResearch({
    runReport,
    taskId: 'missing-research-task',
    research: researchSpec('agent-research-scheduler-missing')
  }),
  /no pending task/
);

console.log(
  `FLUID_AGENT_RESEARCH_SCHEDULER_OK queued=${schedule.sourceCount} `
  + `first=${first.taskId} second=${second.taskId} remaining=${second.pendingResearch.length} `
  + `audit=${second.auditValid}`
);
