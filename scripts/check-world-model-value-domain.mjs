import assert from 'node:assert/strict';

import { Observation, Prediction, WorldModel } from '../src/world-model.mjs';

const invalidValues = [
  ['function', () => 'not data'],
  ['symbol', Symbol('not data')],
  ['bigint', 1n]
];

for (const [label, value] of invalidValues) {
  assert.throws(
    () => new Prediction({ expectedObservation: value }),
    /World-model values|Prediction requires/i,
    `Prediction should reject ${label}`
  );
  assert.throws(
    () => new Observation({ actualObservation: value }),
    /World-model values|Observation requires/i,
    `Observation should reject ${label}`
  );
  assert.throws(
    () => new WorldModel({ history: [{ strategyKey: 'value-domain', metadata: value }] }),
    /World-model values must contain|World-model values must not contain/i,
    `WorldModel history should reject ${label}`
  );
}

console.log('FLUID_WORLD_MODEL_VALUE_DOMAIN_OK');
