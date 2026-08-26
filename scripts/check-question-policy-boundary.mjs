import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';
import { POLICY_MODES } from '../src/evaluation.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'question-policy-boundary-task',
  description: 'Find a graph path'
});
const actionReport = core.execute({
  plan,
  policyMode: POLICY_MODES.RESEARCH,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const question = questionFor({ actionReport });

assert.throws(
  () => core.recordQuestion({
    taskId: actionReport.taskId,
    policyMode: POLICY_MODES.PRODUCTION,
    actionReport,
    question
  }),
  /policy mode must match/
);
assert.equal(core.auditTrail.filter(({ event }) => event === 'question-decided').length, 0);

core.recordQuestion({
  taskId: actionReport.taskId,
  policyMode: POLICY_MODES.RESEARCH,
  actionReport,
  question
});
assert.equal(core.auditTrail.at(-1).payload.policyMode, POLICY_MODES.RESEARCH);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_QUESTION_POLICY_BOUNDARY_OK');
