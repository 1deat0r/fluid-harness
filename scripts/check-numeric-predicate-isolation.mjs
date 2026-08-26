import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const originalFinite = Number.isFinite;
const originalInteger = Number.isInteger;
const originalSafeInteger = Number.isSafeInteger;

try {
  Number.isFinite = () => true;
  Number.isInteger = () => true;
  Number.isSafeInteger = () => true;

  const arrayHarness = new FluidHarness();
  const arrayPlan = arrayHarness.plan({
    id: 'numeric-predicate-array-task',
    description: 'Compute an array sum'
  });
  assert.throws(
    () => arrayHarness.execute({
      plan: arrayPlan,
      input: {
        left: [Number.MAX_VALUE],
        right: [Number.MAX_VALUE],
        operation: 'add'
      }
    }),
    /finite/i
  );

  const graphHarness = new FluidHarness();
  const graphPlan = graphHarness.plan({
    id: 'numeric-predicate-graph-task',
    description: 'Find a graph path'
  });
  assert.throws(
    () => graphHarness.execute({
      plan: graphPlan,
      input: {
        nodes: ['A'],
        edges: [],
        start: 'A',
        goal: 'A'
      },
      executionOptions: { maxExpansions: Number.MAX_SAFE_INTEGER + 1 }
    }),
    /positive integer|safe integer/i
  );
} finally {
  Number.isFinite = originalFinite;
  Number.isInteger = originalInteger;
  Number.isSafeInteger = originalSafeInteger;
}

console.log('FLUID_NUMERIC_PREDICATE_ISOLATION_OK');
