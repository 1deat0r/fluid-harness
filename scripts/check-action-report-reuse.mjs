import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const harness = new FluidHarness();
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 3, maxAuditEntries: 32 }),
  harness
});
const plan = core.plan({ id: 'action-report-reuse-boundary', description: 'Find a graph path' });
const first = core.execute({ plan, input });
assert.equal(core.ownsActionReport(first, plan), true);

harness.execute = () => first;
assert.throws(
  () => core.execute({ plan, input }),
  /already-consumed action report/
);

assert.equal(core.verifyAudit(), true);

console.log('FLUID_ACTION_REPORT_REUSE_OK');
