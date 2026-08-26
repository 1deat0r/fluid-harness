import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  POLICY_MODES
} from '../src/evaluation.mjs';

const cases = [new EvaluationCase({
  id: 'evaluation-audit-capacity-case',
  domain: 'graph',
  task: {
    id: 'evaluation-audit-capacity-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
})];
const budget = new EvaluationBudget({ maxCases: 1 });

const blocked = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 3 })
});
assert.throws(
  () => blocked.evaluate({
    candidateId: 'evaluation-audit-capacity-blocked',
    cases,
    mode: POLICY_MODES.RESEARCH,
    budget
  }),
  /requires 4 entries/
);
assert.equal(blocked.status.actionsUsed, 0);
assert.equal(blocked.learningHistory.length, 0);
assert.equal(blocked.auditTrail.length, 0);
assert.equal(blocked.verifyAudit(), true);

const admitted = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 4 })
});
const report = admitted.evaluate({
  candidateId: 'evaluation-audit-capacity-admitted',
  cases,
  mode: POLICY_MODES.RESEARCH,
  budget
});
assert.equal(report.complete, true);
assert.deepEqual(
  admitted.auditTrail.map(({ event }) => event),
  ['evaluation-started', 'action-admitted', 'action-completed', 'evaluation-completed']
);
assert.equal(admitted.verifyAudit(), true);

console.log('FLUID_EVALUATION_AUDIT_CAPACITY_OK');
