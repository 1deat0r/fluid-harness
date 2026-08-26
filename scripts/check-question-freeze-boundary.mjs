import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { isTrustedQuestionDecision, questionFor } from '../src/curiosity.mjs';
import { POLICY_MODES } from '../src/evaluation.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'question-freeze-boundary-plan',
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

const originalFreeze = Object.freeze;
try {
  Object.freeze = (value) => value;
  const question = questionFor({ actionReport });
  assert.equal(isTrustedQuestionDecision(question, actionReport), true);
  const recorded = core.recordQuestion({
    taskId: plan.task.id,
    policyMode: POLICY_MODES.PRODUCTION,
    question,
    actionReport
  });
  assert.equal(recorded.event, 'question-decided');
  assert.equal(core.verifyAudit(), true);
} finally {
  Object.freeze = originalFreeze;
}

console.log('FLUID_QUESTION_FREEZE_BOUNDARY_OK');
