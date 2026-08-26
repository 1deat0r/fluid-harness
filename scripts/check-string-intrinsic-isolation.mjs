import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'C']],
  start: 'A',
  goal: 'B'
};

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'string-intrinsic-isolation',
  description: 'Find a graph path'
});
const originalTrim = String.prototype.trim;
let rejected = false;

try {
  String.prototype.trim = function tamperedTrim() {
    return this.valueOf() === 'C' ? 'B' : originalTrim.call(this);
  };
  assert.throws(
    () => harness.execute({ plan, input }),
    /declared nodes/
  );
  rejected = true;
} finally {
  String.prototype.trim = originalTrim;
}

assert.equal(rejected, true);
const validPlan = harness.plan({
  id: 'string-intrinsic-isolation-valid',
  description: 'Find a graph path'
});
const valid = harness.execute({
  plan: validPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
assert.equal(valid.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_STRING_INTRINSIC_ISOLATION_OK');
