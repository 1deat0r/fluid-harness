import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const harness = new FluidHarness();
const donorPlan = harness.plan({ id: 'same-task-donor-boundary', description: 'Find a graph path' });
const donorReport = harness.execute({ plan: donorPlan, input });
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
  harness
});
const targetPlan = core.plan({ id: 'same-task-target-boundary', description: 'Find a graph path' });

assert.equal(isTrustedActionReport(donorReport, harness, donorPlan), true);
assert.equal(isTrustedActionReport(donorReport, harness, targetPlan), false);
harness.execute = () => donorReport;

assert.throws(
  () => core.execute({ plan: targetPlan, input }),
  /matching the current plan/
);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_ACTION_REPORT_PLAN_REPLAY_OK');
