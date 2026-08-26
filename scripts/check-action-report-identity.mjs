import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore,
  CORE_EVENTS
} from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

function graphInput() {
  return {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  };
}

const harness = new FluidHarness();
const donorPlan = harness.plan({ id: 'action-report-donor', description: 'Find a graph path' });
const donorReport = harness.execute({ plan: donorPlan, input: graphInput() });
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
  harness
});
const targetPlan = core.plan({ id: 'action-report-target', description: 'Find a graph path' });
harness.execute = () => donorReport;

assert.throws(
  () => core.execute({ plan: targetPlan, input: graphInput() }),
  /matching the current plan/
);
assert.equal(core.auditTrail.at(-1).event, CORE_EVENTS.ACTION_FAILED);
assert.equal(core.verifyAudit(), true);

const validCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
const validPlan = validCore.plan({ id: 'action-report-valid', description: 'Find a graph path' });
const validReport = validCore.execute({ plan: validPlan, input: graphInput() });
assert.equal(validReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log('FLUID_ACTION_REPORT_IDENTITY_OK');
