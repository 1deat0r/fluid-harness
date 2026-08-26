import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const first = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
  harness
});

assert.throws(
  () => new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
    harness
  }),
  /fresh harness/
);

const fresh = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
assert.notEqual(first, fresh);
assert.equal(first.learningHistory.length, 0);
assert.equal(fresh.learningHistory.length, 0);

console.log('FLUID_CORE_HARNESS_ISOLATION_OK');
