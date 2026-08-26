import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { CognitiveCycleReport } from '../src/cycle.mjs';
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
  id: 'cycle-question-consistency',
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
const researchReport = new RepresentationSearchRunner().evaluate({
  candidates: [new RepresentationCandidate({
    id: 'cycle-question-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'cycle-question-case',
    domain: 'graph',
    adversarial: true,
    task: { id: 'cycle-question-task', description: 'Find a graph path' },
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
  () => new CognitiveCycleReport({
    plan,
    actionReport,
    core,
    researchReport,
    questionDecision: questionFor({ actionReport })
  }),
  /researchCompleted.*match/
);
assert.throws(
  () => new CognitiveCycleReport({
    plan,
    actionReport,
    core,
    questionDecision: questionFor({ actionReport, researchCompleted: true })
  }),
  /researchCompleted.*match/
);

console.log('FLUID_CYCLE_QUESTION_CONSISTENCY_OK');
