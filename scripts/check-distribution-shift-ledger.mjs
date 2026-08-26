import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { isTrustedDistributionShiftReport } from '../src/distribution-shift.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'distribution-shift-ledger'
});
const ledger = new EvidenceLedger();
const record = ledger.appendDistributionShift(report);

assert.equal(ledger.verify(), true);
assert.equal(record.kind, 'distribution-shift');
assert.equal(record.sequence, 1);
assert.equal(record.payload.suiteId, report.suiteId);
assert.equal(record.payload.candidateId, report.candidateId);
assert.equal(record.payload.taskId, report.taskId);
assert.equal(record.payload.status, report.status);
assert.equal(record.payload.shiftCount, 2);
assert.equal(record.payload.weaknessesExposed, 1);
assert.equal(record.payload.baseline.role, 'baseline');
assert.equal(record.payload.shifts.length, 2);
assert.equal(record.payload.shifts[1].role, 'shift');
assert.equal(Object.isFrozen(record), true);
assert.equal(Object.isFrozen(record.payload), true);
assert.equal(Object.hasOwn(record.payload, 'runner'), false);
assert.equal(Object.hasOwn(record.payload, 'harness'), false);
assert.equal(Object.hasOwn(record.payload, 'actionReport'), false);
assert.equal(Object.hasOwn(record.payload, 'promotionAuthority'), false);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
assert.equal(restoredLedger.verify(), true);
const restored = restoredLedger.restoreDistributionShifts();
assert.equal(restored.length, 1);
assert.equal(isTrustedDistributionShiftReport(restored[0]), false);
assert.equal(Object.isFrozen(restored[0]), true);
assert.equal(Object.isFrozen(restored[0].baseline), true);
assert.equal(Object.isFrozen(restored[0].shifts), true);
assert.equal(restored[0].status, report.status);
assert.equal(restored[0].baselineSuccess, true);
assert.equal(restored[0].shiftSuccesses, 1);
assert.equal(restored[0].weaknessesExposed, 1);
assert.equal(restored[0].robust, false);
assert.equal(restored[0].requiresReview, true);
assert.equal(restored[0].authorityTransferred, false);
assert.equal(Object.hasOwn(restored[0], 'runner'), false);
assert.equal(Object.hasOwn(restored[0], 'harness'), false);
assert.equal(Object.hasOwn(restored[0], 'actionReport'), false);
assert.equal(Object.hasOwn(restored[0], 'promotionAuthority'), false);

console.log(
  `FLUID_DISTRIBUTION_SHIFT_LEDGER_OK kind=${record.kind} reports=${restored.length} `
  + `shifts=${restored[0].shiftCount} weaknesses=${restored[0].weaknessesExposed} `
  + `status=${restored[0].status} restoredTrusted=${isTrustedDistributionShiftReport(restored[0])} `
  + `frozen=${Object.isFrozen(restored[0])} dataOnly=${restored[0].dataOnly} `
  + `historicalOnly=${restored[0].historicalOnly} authoritySuppressed=`
  + `${restored[0].authorityTransferred === false}`
);
