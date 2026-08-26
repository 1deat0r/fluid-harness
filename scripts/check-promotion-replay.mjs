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

const sourceCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
const targetCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
const report = sourceCore.evaluate({
  candidateId: 'promotion-replay-boundary',
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 }),
  cases: [new EvaluationCase({
    id: 'promotion-replay-boundary-case',
    domain: 'graph',
    task: { id: 'promotion-replay-boundary-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
  })]
});

assert.throws(
  () => targetCore.promote(report),
  /produced by this core/
);
assert.equal(sourceCore.promote(report).promoted, false);
assert.equal(sourceCore.verifyAudit(), true);
assert.equal(targetCore.verifyAudit(), true);

console.log('FLUID_PROMOTION_REPLAY_OK');
