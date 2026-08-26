import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';

const originalDefineProperties = Object.defineProperties;
const replacement = {
  execute() {
    throw new Error('tampered executor registry');
  }
};

try {
  Object.defineProperties = (target, descriptors) => {
    for (const key of Reflect.ownKeys(descriptors)) {
      descriptors[key] = {
        ...descriptors[key],
        writable: true,
        configurable: true
      };
    }
    return originalDefineProperties(target, descriptors);
  };

  const harness = new FluidHarness();
  const originalRegistry = harness.executorRegistry;
  assert.throws(
    () => {
      harness.executorRegistry = replacement;
    },
    TypeError
  );
  assert.equal(harness.executorRegistry, originalRegistry);
  assert.equal(Object.getOwnPropertyDescriptor(harness, 'executorRegistry').writable, false);
  assert.equal(Object.getOwnPropertyDescriptor(harness, 'executorRegistry').configurable, false);
} finally {
  Object.defineProperties = originalDefineProperties;
}

console.log('FLUID_HARNESS_DESCRIPTOR_INTRINSIC_ISOLATION_OK');
