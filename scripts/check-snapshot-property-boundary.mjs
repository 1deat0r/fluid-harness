import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { ScalingLevel } from '../src/scaling.mjs';
import { WorldModel } from '../src/world-model.mjs';

function hiddenValue() {
  const value = {};
  Object.defineProperty(value, 'hidden', {
    value: 'not visible',
    enumerable: false,
    writable: true,
    configurable: true
  });
  return value;
}

function symbolValue() {
  const value = {};
  value[Symbol('hidden')] = 'not visible';
  return value;
}

function accessorValue() {
  const value = {};
  Object.defineProperty(value, 'dynamic', {
    enumerable: true,
    get() {
      return 'computed';
    }
  });
  return value;
}

const boundaryValues = [hiddenValue, symbolValue, accessorValue];

for (const makeValue of boundaryValues) {
  assert.throws(
    () => new WorldModel({ history: [{ metadata: makeValue() }] }),
    /World-model values must contain only enumerable data properties/
  );

  assert.throws(
    () => new EvaluationCase({
      id: 'snapshot-property-boundary-case',
      domain: 'snapshot-boundary',
      task: { id: 'snapshot-property-boundary-task', description: 'Probe properties' },
      input: { metadata: makeValue() },
      expected: () => true
    }),
    /Evaluation snapshot values must contain only enumerable data properties/
  );

  assert.throws(
    () => new ScalingLevel({
      id: 'snapshot-property-boundary-level',
      computeUnits: 1,
      executionOptions: { metadata: makeValue() }
    }),
    /Scaling snapshot values must contain only enumerable data properties/
  );

  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'snapshot-property-boundary-plan',
    description: 'Find a graph path'
  });
  assert.throws(
    () => harness.execute({
      plan,
      input: {
        nodes: ['A', 'B'],
        edges: [['A', 'B']],
        start: 'A',
        goal: 'B',
        metadata: makeValue()
      }
    }),
    /Harness values must contain only enumerable data properties/
  );
}

console.log('FLUID_SNAPSHOT_PROPERTY_BOUNDARY_OK');
