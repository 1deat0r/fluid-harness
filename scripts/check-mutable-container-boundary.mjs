import assert from 'node:assert/strict';

import { FluidHarness } from '../src/harness.mjs';
import { WorldModel } from '../src/world-model.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'mutable-container-boundary-plan',
  description: 'Find a graph path'
});

assert.throws(
  () => harness.record({
    plan,
    actualObservation: 'graph path resolved',
    result: { metadata: new Map([['status', 'original']]) }
  }),
  /mutable containers/
);

assert.throws(
  () => harness.record({
    plan,
    actualObservation: 'graph path resolved',
    result: { metadata: new Set(['original']) }
  }),
  /mutable containers/
);

assert.throws(
  () => new WorldModel({
    history: [{ metadata: new Map([['status', 'original']]) }]
  }),
  /mutable containers/
);

assert.throws(
  () => new WorldModel({
    history: [{ metadata: new Set(['original']) }]
  }),
  /mutable containers/
);

console.log('FLUID_MUTABLE_CONTAINER_BOUNDARY_OK');
