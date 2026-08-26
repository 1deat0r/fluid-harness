import assert from 'node:assert/strict';

import {
  ConstitutionalCore,
  Constitution,
  CORE_EVENTS
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { questionFor } from '../src/curiosity.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

function graphTask(id) {
  return { id, description: 'Find a graph path' };
}

function noPathInput() {
  return {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  };
}

const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 4, maxAuditEntries: 32 })
});
const plan = core.plan(graphTask('research-queue-action'));
const actionReport = core.execute({ plan, input: noPathInput() });
const question = questionFor({ actionReport });
assert.equal(question.researchRequired, true);
core.recordQuestion({
  taskId: plan.task.id,
  actionReport,
  question
});

assert.equal(core.researchQueue.length, 1);
assert.equal(core.researchQueue[0].taskId, plan.task.id);
assert.equal(core.researchQueue[0].actionNumber, 1);
assert.equal(Object.isFrozen(core.researchQueue), true);
assert.equal(Object.isFrozen(core.researchQueue[0]), true);
assert.equal(JSON.stringify(core.researchQueue).includes('function'), false);
assert.throws(() => {
  core.researchQueue[0].taskId = 'tampered';
}, TypeError);

const researchReport = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'research-queue-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'research-queue-case',
    domain: 'graph',
    adversarial: true,
    task: graphTask('research-queue-case-task'),
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
});
assert.equal(researchReport.complete, true);

assert.throws(
  () => core.recordResearchCompletion({
    actionReport,
    researchReport: { complete: true }
  }),
  /complete trusted search report/
);

const foreignCore = new ConstitutionalCore();
const foreignPlan = foreignCore.plan(graphTask('foreign-research-queue-action'));
const foreignAction = foreignCore.execute({ plan: foreignPlan, input: noPathInput() });
assert.throws(
  () => core.recordResearchCompletion({
    actionReport: foreignAction,
    researchReport
  }),
  /produced by this core/
);

core.recordResearchCompletion({ actionReport, researchReport });
assert.equal(core.researchQueue.length, 0);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.RESEARCH_COMPLETED);
assert.equal(core.verifyAudit(), true);
assert.throws(
  () => core.recordResearchCompletion({ actionReport, researchReport }),
  /queued research question/
);

console.log(
  `FLUID_RESEARCH_QUEUE_OK pendingBefore=1 pendingAfter=${core.researchQueue.length} `
  + `completed=${core.auditTrail.filter(({ event }) => event === CORE_EVENTS.RESEARCH_COMPLETED).length} audit=${core.verifyAudit()}`
);
