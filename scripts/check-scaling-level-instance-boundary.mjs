import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import {
  ScalingLevel,
  ScalingRunner,
  isTrustedScalingLevel
} from '../src/scaling.mjs';

const spoofedPrototype = Object.create(ScalingLevel.prototype);
Object.defineProperties(spoofedPrototype, {
  id: { get: () => 'scaling-level-instance-spoofed' },
  computeUnits: { get: () => 1 },
  executionOptions: { get: () => ({}) }
});
const spoofed = Object.freeze(Object.create(spoofedPrototype));
assert.equal(spoofed instanceof ScalingLevel, true);
assert.equal(isTrustedScalingLevel(spoofed), false);

const curve = new ScalingRunner().evaluate({
  candidateId: 'scaling-level-instance-boundary',
  cases: [new EvaluationCase({
    id: 'scaling-level-instance-boundary-case',
    domain: 'graph',
    task: {
      id: 'scaling-level-instance-boundary-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (value) => value?.result?.path?.join('>') === 'A>B'
  })],
  levels: [spoofed]
});
assert.equal(curve.points.length, 1);
assert.equal(curve.points[0].levelId, 'scaling-level-instance-spoofed');
assert.equal(curve.points[0].computeUnits, 1);

const real = new ScalingLevel({ id: 'scaling-level-instance-real', computeUnits: 1 });
assert.equal(isTrustedScalingLevel(real), true);
const proxied = new Proxy(real, {});
assert.equal(isTrustedScalingLevel(proxied), false);

class DerivedScalingLevel extends ScalingLevel {}
const derived = new DerivedScalingLevel({ id: 'scaling-level-instance-derived', computeUnits: 1 });
assert.equal(isTrustedScalingLevel(derived), false);

console.log('FLUID_SCALING_LEVEL_INSTANCE_BOUNDARY_OK');
