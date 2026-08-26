import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import { ScalingLevel, ScalingRunner } from '../src/scaling.mjs';

const originalNumber = Number;
const evaluationCase = new EvaluationCase({
  id: 'number-conversion-intrinsic-isolation-case',
  domain: 'graph',
  task: {
    id: 'number-conversion-intrinsic-isolation-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: () => true
});

try {
  globalThis.Number = () => 0;
  const curve = new ScalingRunner().evaluate({
    candidateId: 'number-conversion-intrinsic-isolation',
    cases: [evaluationCase],
    levels: [new ScalingLevel({ id: 'level', computeUnits: 1 })]
  });
  assert.equal(curve.points[0].complete, true);
  assert.equal(curve.points[0].provenRate, 1);
  assert.ok(curve.points[0].elapsedMs > 0);
} finally {
  globalThis.Number = originalNumber;
}

console.log('FLUID_NUMBER_CONVERSION_INTRINSIC_ISOLATION_OK');
