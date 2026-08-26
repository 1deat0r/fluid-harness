import assert from 'node:assert/strict';

import { EvaluationCase, EvaluationRunner, POLICY_MODES } from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const originalFreeze = Object.freeze;
try {
  Object.freeze = (value) => value;
  const harness = new FluidHarness();
  const evaluationCase = new EvaluationCase({
    id: 'freeze-tamper-boundary-case',
    domain: 'graph',
    task: { id: 'freeze-tamper-boundary-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B', 'C'],
      edges: [['A', 'B'], ['B', 'C']],
      start: 'A',
      goal: 'C'
    },
    expected: () => true
  });
  let report = null;
  let error = null;
  try {
    report = new EvaluationRunner({ harness }).evaluate({
      candidateId: 'freeze-tamper-boundary',
      cases: [evaluationCase],
      mode: POLICY_MODES.RESEARCH
    });
  } catch (caught) {
    error = caught;
  }
  if (report !== null) {
    assert.equal(report.successRate, 1);
    assert.equal(report.proven, 1);
    assert.equal(report.results[0].success, true);
  } else {
    assert.match(error?.message ?? '', /Evaluation requires an EvaluationBudget/);
  }
} finally {
  Object.freeze = originalFreeze;
}

console.log('FLUID_FREEZE_TAMPER_BOUNDARY_OK');
