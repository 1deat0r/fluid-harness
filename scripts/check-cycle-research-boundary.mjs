import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase
} from '../src/evaluation.mjs';
import { CognitiveCycleRunner } from '../src/cycle.mjs';
import {
  HeuristicRepresentationSelector
} from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

const graphInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const cases = [new EvaluationCase({
  id: 'cycle-research-boundary-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'cycle-research-boundary-task', description: 'Find a graph path' },
  input: graphInput,
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budgets = {
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const sharedSelector = new HeuristicRepresentationSelector();
const incompleteResearch = {
  candidates: [new RepresentationCandidate({
    id: 'incomplete-cycle-research',
    selector: sharedSelector
  })],
  cases,
  ...budgets
};

assert.throws(
  () => new CognitiveCycleRunner().run({
    task: { id: 'cycle-invalid-research', description: 'Find a graph path' },
    input: { ...graphInput, edges: [] },
    research: incompleteResearch
  }),
  /complete trusted search report/
);

const completeResearch = {
  candidates: [new RepresentationCandidate({
    id: 'complete-cycle-research',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases,
  ...budgets
};
const valid = new CognitiveCycleRunner({ searchRunner: new RepresentationSearchRunner() }).run({
  task: { id: 'cycle-valid-research', description: 'Find a graph path' },
  input: { ...graphInput, edges: [] },
  research: completeResearch
});
assert.equal(valid.stages.question.researchCompleted, true);
assert.equal(valid.stages.question.researchRequired, false);
assert.equal(valid.stages.preserve.researchAuditValid, true);

console.log('FLUID_CYCLE_RESEARCH_BOUNDARY_OK');
