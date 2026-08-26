import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  ConstitutionalCore
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

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'question-research-boundary',
  description: 'Find a graph path'
});
const actionReport = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const selfAttestedQuestion = questionFor({
  actionReport,
  researchCompleted: true
});

assert.throws(
  () => core.recordQuestion({
    taskId: actionReport.taskId,
    actionReport,
    question: selfAttestedQuestion
  }),
  /complete trusted search report/
);

const researchReport = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'question-research-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'question-research-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'question-research-task', description: 'Find a graph path' },
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

core.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: selfAttestedQuestion,
  researchReport
});
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.QUESTION_DECIDED).length,
  1
);
assert.equal(core.auditTrail.at(-1).payload.researchCompleted, true);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_QUESTION_RESEARCH_BOUNDARY_OK');
