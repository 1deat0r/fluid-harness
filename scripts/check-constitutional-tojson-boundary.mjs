import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const baseInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

function assertRejected(metadata) {
  const core = new ConstitutionalCore();
  const plan = core.plan({ id: 'constitutional-tojson-boundary-plan', description: 'Find a graph path' });
  assert.throws(
    () => core.execute({ plan, input: { ...baseInput, metadata } }),
    /Input must contain only JSON-compatible values/
  );
  assert.equal(core.status.actionsUsed, 0);
}

assertRejected({
  toJSON() {
    return {};
  }
});

const hiddenHook = {};
Object.defineProperty(hiddenHook, 'toJSON', {
  value: () => ({}),
  enumerable: false
});
assertRejected(hiddenHook);

console.log('FLUID_CONSTITUTIONAL_TOJSON_BOUNDARY_OK');
