import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import { ScalingLevel, ScalingRunner } from '../src/scaling.mjs';

const originalBigint = process.hrtime.bigint;
const evaluationCase = new EvaluationCase({
  id: 'clock-intrinsic-isolation-case',
  domain: 'graph',
  task: {
    id: 'clock-intrinsic-isolation-task',
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
  process.hrtime.bigint = () => 0n;
  const curve = new ScalingRunner().evaluate({
    candidateId: 'clock-intrinsic-isolation',
    cases: [evaluationCase],
    levels: [new ScalingLevel({ id: 'level', computeUnits: 1 })]
  });
  assert.equal(curve.points[0].complete, true);
  assert.equal(curve.points[0].provenRate, 1);
  assert.ok(curve.points[0].elapsedMs > 0);
} finally {
  process.hrtime.bigint = originalBigint;
}

console.log('FLUID_CLOCK_INTRINSIC_ISOLATION_OK');
