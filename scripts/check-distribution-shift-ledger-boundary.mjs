import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildDistributionShiftFixture } from './fixtures/distribution-shift.mjs';

const { report } = buildDistributionShiftFixture({
  prefix: 'distribution-shift-ledger-boundary'
});

assert.throws(
  () => new EvidenceLedger().appendDistributionShift({}),
  /trusted distribution-shift report/
);
const forged = Object.create(Object.getPrototypeOf(report));
Object.assign(forged, report);
assert.throws(
  () => new EvidenceLedger().appendDistributionShift(forged),
  /trusted distribution-shift report/
);
assert.throws(
  () => new EvidenceLedger().appendDistributionShift(Object.freeze({
    ...report,
    runner: {}
  })),
  /trusted distribution-shift report/
);

const ledger = new EvidenceLedger();
ledger.appendDistributionShift(report);
const serialized = JSON.parse(ledger.serialize());
const tamperedMetrics = structuredClone(serialized);
tamperedMetrics.records[0].payload.weaknessesExposed = 0;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedMetrics)),
  /hash verification failed|inconsistent/
);
const tamperedNested = structuredClone(serialized);
tamperedNested.records[0].payload.shifts[0].success = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedNested)),
  /hash verification failed|inconsistent/
);
const boundaryChanged = structuredClone(serialized);
boundaryChanged.records[0].payload.productionEligible = true;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(boundaryChanged)),
  /hash verification failed|proof boundary/
);
const artifact = structuredClone(serialized);
artifact.records[0].payload.actionReport = {};
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(artifact)),
  /hash verification failed|invalid shape/
);
const invalidKind = structuredClone(serialized);
invalidKind.records[0].kind = 'distribution-shift-forged';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(invalidKind)),
  /Unknown evidence ledger kind/
);

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const restored = restoredLedger.restoreDistributionShifts();
assert.equal(restored.length, 1);
assert.equal(restored[0].status, report.status);
assert.equal(restored[0].weaknessesExposed, 1);
assert.equal(restored[0].robust, false);
assert.equal(Object.hasOwn(restored[0], 'runner'), false);
assert.equal(Object.hasOwn(restored[0], 'actionReport'), false);
assert.equal(Object.hasOwn(restored[0], 'promotionAuthority'), false);

console.log(
  `FLUID_DISTRIBUTION_SHIFT_LEDGER_BOUNDARY_OK forgedRejected=true `
  + `tamperedMetricsRejected=true nestedTamperRejected=true boundaryRejected=true `
  + `artifactRejected=true invalidKindRejected=true weaknesses=${restored[0].weaknessesExposed} `
  + `status=${restored[0].status} authoritySuppressed=true`
);
