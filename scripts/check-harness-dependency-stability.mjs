import assert from 'node:assert/strict';

import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { VerifierRegistry } from '../src/verification.mjs';

const harness = new FluidHarness();
const originalSelector = harness.selector;
const originalExecutorRegistry = harness.executorRegistry;
const originalVerifierRegistry = harness.verifierRegistry;

assert.equal(Object.getOwnPropertyDescriptor(harness, 'selector').writable, false);
assert.equal(Object.getOwnPropertyDescriptor(harness, 'executorRegistry').writable, false);
assert.equal(Object.getOwnPropertyDescriptor(harness, 'verifierRegistry').writable, false);
assert.throws(
  () => {
    harness.selector = { select: () => 'graph' };
  },
  TypeError
);
assert.throws(
  () => {
    harness.executorRegistry = new ExecutorRegistry();
  },
  TypeError
);
assert.throws(
  () => {
    harness.verifierRegistry = new VerifierRegistry();
  },
  TypeError
);
assert.equal(harness.selector, originalSelector);
assert.equal(harness.executorRegistry, originalExecutorRegistry);
assert.equal(harness.verifierRegistry, originalVerifierRegistry);

console.log('FLUID_HARNESS_DEPENDENCY_STABILITY_OK');
