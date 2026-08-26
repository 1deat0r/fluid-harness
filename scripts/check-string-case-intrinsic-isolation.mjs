import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'string-case-intrinsic-isolation',
  description: 'Compute a numeric array'
});
const originalLower = String.prototype.toLowerCase;
let tamperedReport;

try {
  String.prototype.toLowerCase = function tamperedLower() {
    return this.valueOf() === 'add' ? 'dot' : originalLower.call(this);
  };
  tamperedReport = harness.execute({
    plan,
    input: {
      left: [2, 3],
      right: [4, 5],
      operation: 'add'
    }
  });
} finally {
  String.prototype.toLowerCase = originalLower;
}

assert.equal(tamperedReport.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(tamperedReport.result.operation, 'add');
assert.deepEqual(tamperedReport.result.values, [6, 8]);

const validPlan = harness.plan({
  id: 'string-case-intrinsic-isolation-valid',
  description: 'Compute a numeric array'
});
const valid = harness.execute({
  plan: validPlan,
  input: {
    left: [2, 3],
    right: [4, 5],
    operation: 'add'
  }
});
assert.equal(valid.evidence, EVIDENCE_LEVELS.PROVEN);
assert.deepEqual(valid.result.values, [6, 8]);

console.log('FLUID_STRING_CASE_INTRINSIC_ISOLATION_OK');
