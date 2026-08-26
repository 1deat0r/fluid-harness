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
const source = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
const target = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 })
});
const plan = source.plan({ id: 'shared-harness-plan-boundary', description: 'Find a graph path' });

assert.equal(source.ownsPlan(plan), true);
assert.equal(target.ownsPlan(plan), false);
assert.throws(
  () => target.execute({ plan, input }),
  /trusted Plan owned by this core/
);

const report = source.execute({ plan, input });
assert.equal(report.taskId, plan.task.id);
assert.equal(source.verifyAudit(), true);
assert.equal(target.verifyAudit(), true);

console.log('FLUID_PLAN_CORE_ISOLATION_OK');
