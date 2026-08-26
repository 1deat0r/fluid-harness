import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const originalTest = RegExp.prototype.test;
const originalRegExp = RegExp;
try {
  RegExp.prototype.test = function tamperedTest(input) {
    if (
      this.source.includes('array')
      || this.source.includes('numeric')
      || this.source.includes('vector')
      || this.source.includes('matrix')
    ) {
      return true;
    }
    return originalTest.call(this, input);
  };
  globalThis.RegExp = function tamperedRegExp(pattern, flags) {
    const source = String(pattern);
    if (
      source.includes('array')
      || source.includes('numeric')
      || source.includes('vector')
      || source.includes('matrix')
    ) {
      return new originalRegExp('graph', flags);
    }
    return new originalRegExp(pattern, flags);
  };

  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'regexp-test-intrinsic-isolation-task',
    description: 'Find a graph path'
  });
  assert.equal(plan.strategy.representation, REPRESENTATIONS.GRAPH);
  assert.throws(
    () => harness.execute({
      plan,
      input: { left: [1], right: [2], operation: 'add' }
    }),
    /Graph input requires nodes and edges arrays/
  );
} finally {
  globalThis.RegExp = originalRegExp;
  originalRegExp.prototype.test = originalTest;
}

console.log('FLUID_REGEXP_TEST_INTRINSIC_ISOLATION_OK');
