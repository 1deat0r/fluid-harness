import assert from 'node:assert/strict';

import { Observation, Prediction, SURPRISE_BANDS, WorldModel } from '../src/world-model.mjs';

const model = new WorldModel({ highSurpriseThreshold: 1 });
const prediction = new Prediction({
  expectedObservation: {
    status: 'ready',
    metrics: { count: 2, values: [3, 5] }
  },
  strategyKey: 'structured-engine'
});

const matching = model.measure(prediction, new Observation({
  actualObservation: {
    metrics: { values: [3, 5], count: 2 },
    status: 'ready'
  }
}));
assert.equal(matching.predictionError, false);
assert.equal(matching.surpriseBand, SURPRISE_BANDS.LOW);

const mismatching = model.measure(prediction, new Observation({
  actualObservation: {
    status: 'ready',
    metrics: { count: 2, values: [3, 6] }
  }
}));
assert.equal(mismatching.predictionError, true);
assert.equal(mismatching.surpriseBand, SURPRISE_BANDS.HIGH);

const shared = { value: 1 };
const sharedPrediction = new Prediction({
  expectedObservation: { left: shared, right: shared },
  strategyKey: 'shared-structure-engine'
});
const equivalentWithSeparateObjects = model.measure(sharedPrediction, new Observation({
  actualObservation: { left: { value: 1 }, right: { value: 1 } }
}));
assert.equal(equivalentWithSeparateObjects.predictionError, false);

console.log('FLUID_STRUCTURED_OBSERVATION_EQUALITY_OK');
