import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';

const donor = new FluidHarness();
const donorPlan = donor.plan({ id: 'donor-report-boundary', description: 'Find a graph path' });
const donorReport = donor.execute({
  plan: donorPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});

class ReplayingHarness extends FluidHarness {
  execute() {
    return donorReport;
  }
}

const harness = new ReplayingHarness();
const core = new ConstitutionalCore({ harness });
const plan = core.plan({ id: 'replay-report-boundary', description: 'Find a graph path' });

assert.equal(isTrustedActionReport(donorReport, donor), true);
assert.equal(isTrustedActionReport(donorReport, harness), false);
assert.throws(
  () => core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  }),
  /trusted action report/
);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_ACTION_REPORT_REPLAY_OK');
