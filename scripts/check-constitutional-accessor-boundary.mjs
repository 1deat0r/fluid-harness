import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';

const baseInput = {
  nodes: ['A'],
  edges: [],
  start: 'A',
  goal: 'A'
};

function assertRejected(input) {
  const core = new ConstitutionalCore();
  const plan = core.plan({
    id: 'constitutional-accessor-boundary-plan',
    description: 'Find a graph path'
  });
  assert.throws(
    () => core.execute({ plan, input }),
    /Input must contain only JSON-compatible values/
  );
  assert.equal(core.status.actionsUsed, 0);
}

const topLevelGetter = { ...baseInput };
Object.defineProperty(topLevelGetter, 'metadata', {
  enumerable: true,
  get() {
    return { dynamic: true };
  }
});
assertRejected(topLevelGetter);

const arrayIndexGetter = { ...baseInput, nodes: [] };
Object.defineProperty(arrayIndexGetter.nodes, '0', {
  enumerable: true,
  get() {
    return 'A';
  }
});
arrayIndexGetter.nodes.length = 1;
assertRejected(arrayIndexGetter);

const hiddenArrayIndex = { ...baseInput, nodes: [] };
Object.defineProperty(hiddenArrayIndex.nodes, '0', {
  enumerable: false,
  value: 'A'
});
hiddenArrayIndex.nodes.length = 1;
assertRejected(hiddenArrayIndex);

console.log('FLUID_CONSTITUTIONAL_ACCESSOR_BOUNDARY_OK');
