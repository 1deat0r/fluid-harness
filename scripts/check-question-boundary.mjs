import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import {
  isTrustedQuestionDecision,
  QuestionDecision,
  questionFor
} from '../src/curiosity.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({ id: 'question-boundary', description: 'Find a graph path' });
const actionReport = core.execute({
  plan,
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  }
});
const forged = new QuestionDecision({ actionReport });
const trusted = questionFor({ actionReport });

assert.equal(isTrustedQuestionDecision(forged), false);
assert.equal(isTrustedQuestionDecision(trusted), true);
assert.throws(
  () => core.recordQuestion({
    taskId: actionReport.taskId,
    actionReport,
    question: forged
  }),
  /trusted policy/
);
core.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: trusted
});
assert.equal(core.verifyAudit(), true);
console.log('FLUID_QUESTION_BOUNDARY_OK');
