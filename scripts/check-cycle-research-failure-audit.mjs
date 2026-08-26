import assert from 'node:assert/strict';

import { Constitution, ConstitutionalCore, CORE_EVENTS } from '../src/constitution.mjs';
import { CognitiveCycleRunner } from '../src/cycle.mjs';
import { EvaluationBudget, EvaluationCase } from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { RepresentationCandidate } from '../src/search.mjs';
import { QUESTION_REASONS } from '../src/curiosity.mjs';

const graphInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const researchCases = [new EvaluationCase({
  id: 'cycle-research-failure-audit-case',
  domain: 'graph',
  adversarial: true,
  task: { id: 'cycle-research-failure-audit-task', description: 'Find a graph path' },
  input: graphInput,
  expected: (report) => report?.result?.path?.join('>') === 'A>B'
})];
const incompleteResearch = {
  candidates: [new RepresentationCandidate({
    id: 'cycle-research-failure-audit-candidate',
    selector: new HeuristicRepresentationSelector()
  })],
  cases: researchCases,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxAuditEntries: 20 })
});

assert.throws(
  () => new CognitiveCycleRunner({ core }).run({
    task: { id: 'cycle-research-failure-audit-task-main', description: 'Find a graph path' },
    input: graphInput,
    research: incompleteResearch
  }),
  /complete trusted search report/
);

assert.equal(core.status.actionsUsed, 1);
assert.deepEqual(
  core.auditTrail.map(({ event }) => event),
  [CORE_EVENTS.ACTION_ADMITTED, CORE_EVENTS.ACTION_COMPLETED, CORE_EVENTS.QUESTION_DECIDED]
);
const question = core.auditTrail.at(-1).payload;
assert.equal(question.reason, QUESTION_REASONS.EXPLICIT_RESEARCH);
assert.equal(question.requested, true);
assert.equal(question.researchRequested, true);
assert.equal(question.researchCompleted, false);
assert.equal(question.researchRequired, true);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CYCLE_RESEARCH_FAILURE_AUDIT_OK');
