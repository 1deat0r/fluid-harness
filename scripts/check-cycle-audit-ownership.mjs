import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { CognitiveCycleReport } from '../src/cycle.mjs';
import { questionFor } from '../src/curiosity.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'cycle-audit-ownership-task',
  description: 'Find a graph path'
});
const actionReport = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const questionDecision = questionFor({ actionReport });

assert.throws(
  () => new CognitiveCycleReport({
    plan,
    actionReport,
    core,
    questionDecision
  }),
  /recorded by the supplied core/
);
assert.equal(core.auditTrail.filter(({ event }) => event === 'question-decided').length, 0);

core.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: questionDecision
});
const cycle = new CognitiveCycleReport({
  plan,
  actionReport,
  core,
  questionDecision
});
assert.equal(cycle.stages.preserve.coreAuditValid, true);
assert.equal(core.auditTrail.filter(({ event }) => event === 'question-decided').length, 1);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_CYCLE_AUDIT_OWNERSHIP_OK');
