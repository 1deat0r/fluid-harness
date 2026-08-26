import assert from 'node:assert/strict';

import { Observation, Prediction, WorldModel } from '../src/world-model.mjs';

const model = new WorldModel();
const prediction = new Prediction({
  expectedObservation: 'expected',
  strategyKey: 'history-immutability'
});
const signal = model.measure(
  prediction,
  new Observation({ actualObservation: 'expected' })
);
const metadata = {
  nested: { count: 1 },
  values: [1, 2]
};
const updated = model.update({ ...signal, metadata });

metadata.nested.count = 99;
metadata.values.push(3);
assert.equal(updated.history[0].metadata.nested.count, 1);
assert.deepEqual(updated.history[0].metadata.values, [1, 2]);
assert.equal(Object.isFrozen(updated.history[0].metadata), true);
assert.equal(Object.isFrozen(updated.history[0].metadata.nested), true);
assert.equal(Object.isFrozen(updated.history[0].metadata.values), true);
assert.throws(
  () => {
    updated.history[0].metadata.nested.count = 4;
  },
  TypeError
);

console.log('FLUID_WORLD_MODEL_HISTORY_IMMUTABILITY_OK');
