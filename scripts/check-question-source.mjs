import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import {
  isTrustedQuestionDecision,
  questionFor
} from '../src/curiosity.mjs';

const core = new ConstitutionalCore();
const firstPlan = core.plan({ id: 'question-source-one', description: 'Find a graph path' });
const firstReport = core.execute({
  plan: firstPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  }
});
const secondPlan = core.plan({ id: 'question-source-two', description: 'Find a graph path' });
const secondReport = core.execute({
  plan: secondPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [],
    start: 'A',
    goal: 'B'
  }
});
const firstQuestion = questionFor({ actionReport: firstReport });
const secondQuestion = questionFor({ actionReport: secondReport });

assert.equal(isTrustedQuestionDecision(firstQuestion, firstReport), true);
assert.equal(isTrustedQuestionDecision(firstQuestion, secondReport), false);
assert.throws(
  () => core.recordQuestion({
    taskId: secondReport.taskId,
    actionReport: secondReport,
    question: firstQuestion
  }),
  /trusted policy/
);
assert.throws(
  () => core.recordQuestion({
    taskId: firstReport.taskId,
    actionReport: secondReport,
    question: secondQuestion
  }),
  /taskId must match/
);
core.recordQuestion({
  taskId: firstReport.taskId,
  actionReport: firstReport,
  question: firstQuestion
});
assert.equal(core.verifyAudit(), true);

console.log('FLUID_QUESTION_SOURCE_OK');
