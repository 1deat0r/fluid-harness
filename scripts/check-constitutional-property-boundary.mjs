import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const baseInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

function assertRejected(input) {
  const core = new ConstitutionalCore();
  const plan = core.plan({ id: 'constitutional-property-boundary-plan', description: 'Find a graph path' });
  assert.throws(
    () => core.execute({ plan, input }),
    /Input must contain only JSON-compatible values/
  );
  assert.equal(core.status.actionsUsed, 0);
}

const symbolInput = { ...baseInput };
symbolInput[Symbol('hidden')] = 'unsupported';
assertRejected(symbolInput);

const extraArrayPropertyInput = {
  ...baseInput,
  nodes: ['A', 'B']
};
extraArrayPropertyInput.nodes.extra = 'unsupported';
assertRejected(extraArrayPropertyInput);

const hiddenInput = { ...baseInput };
Object.defineProperty(hiddenInput, 'hidden', {
  value: 'unsupported',
  enumerable: false
});
assertRejected(hiddenInput);

console.log('FLUID_CONSTITUTIONAL_PROPERTY_BOUNDARY_OK');
