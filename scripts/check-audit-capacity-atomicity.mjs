import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';

const graphInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};

const actionCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 1 })
});
const actionPlan = actionCore.plan({
  id: 'audit-capacity-action',
  description: 'Find a graph path'
});
assert.throws(
  () => actionCore.execute({ plan: actionPlan, input: graphInput }),
  /requires 2 entries/
);
assert.equal(actionCore.status.actionsUsed, 0);
assert.equal(actionCore.learningHistory.length, 0);
assert.equal(actionCore.auditTrail.length, 0);
assert.equal(actionCore.verifyAudit(), true);

const shutdownCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 2 })
});
const shutdownPlan = shutdownCore.plan({
  id: 'audit-capacity-shutdown',
  description: 'Find a graph path'
});
const shutdownReport = shutdownCore.execute({ plan: shutdownPlan, input: graphInput });
assert.ok(shutdownReport);
assert.throws(
  () => shutdownCore.shutdown('audit capacity probe'),
  /capacity exhausted/
);
assert.equal(shutdownCore.status.shutdown, false);
assert.deepEqual(
  shutdownCore.auditTrail.map(({ event }) => event),
  ['action-admitted', 'action-completed']
);
assert.equal(shutdownCore.verifyAudit(), true);

const questionCore = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 1, maxAuditEntries: 2 })
});
const questionPlan = questionCore.plan({
  id: 'audit-capacity-question',
  description: 'Find a graph path'
});
const questionReport = questionCore.execute({ plan: questionPlan, input: graphInput });
const question = questionFor({ actionReport: questionReport });
assert.throws(
  () => questionCore.recordQuestion({
    taskId: questionReport.taskId,
    actionReport: questionReport,
    question
  }),
  /capacity exhausted/
);
assert.throws(
  () => questionCore.recordQuestion({
    taskId: questionReport.taskId,
    actionReport: questionReport,
    question
  }),
  /capacity exhausted/
);
assert.equal(questionCore.auditTrail.length, 2);
assert.equal(questionCore.verifyAudit(), true);

console.log('FLUID_AUDIT_CAPACITY_ATOMICITY_OK');
