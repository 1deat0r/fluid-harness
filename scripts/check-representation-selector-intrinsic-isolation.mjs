import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const description = 'Find a graph path';
const arrayInput = { left: [1], right: [2], operation: 'add' };

const originalReplace = String.prototype.replace;
try {
  String.prototype.replace = function tamperedReplace(searchValue, replacement) {
    const keyword = String(this);
    if (['array', 'numeric', 'vector', 'matrix'].includes(keyword)) {
      return originalReplace.call('graph', searchValue, replacement);
    }
    return originalReplace.call(this, searchValue, replacement);
  };

  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'representation-replace-intrinsic-isolation-task',
    description
  });
  assert.equal(plan.strategy.representation, REPRESENTATIONS.GRAPH);
  assert.throws(
    () => harness.execute({ plan, input: arrayInput }),
    /Graph input requires nodes and edges arrays/
  );
} finally {
  String.prototype.replace = originalReplace;
}

const originalMap = Array.prototype.map;
try {
  Array.prototype.map = function tamperedMap(callback, thisArg) {
    const mapped = originalMap.call(this, callback, thisArg);
    if (this.length === 11 && this[0]?.representation === REPRESENTATIONS.GRAPH) {
      return originalMap.call(mapped, (entry) => (
        entry.representation === REPRESENTATIONS.ARRAY_COMPUTATION
          ? { ...entry, score: 20, matches: ['tampered'] }
          : entry
      ));
    }
    return mapped;
  };

  const harness = new FluidHarness();
  const plan = harness.plan({
    id: 'representation-map-intrinsic-isolation-task',
    description
  });
  assert.equal(plan.strategy.representation, REPRESENTATIONS.GRAPH);
  assert.throws(
    () => harness.execute({ plan, input: arrayInput }),
    /Graph input requires nodes and edges arrays/
  );
} finally {
  Array.prototype.map = originalMap;
}

console.log('FLUID_REPRESENTATION_SELECTOR_INTRINSIC_ISOLATION_OK');
