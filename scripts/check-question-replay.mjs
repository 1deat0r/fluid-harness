import assert from 'node:assert/strict';

import {
  CORE_EVENTS,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'question-replay-boundary',
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
const firstQuestion = questionFor({ actionReport });

core.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: firstQuestion
});
assert.throws(
  () => core.recordQuestion({
    taskId: actionReport.taskId,
    actionReport,
    question: firstQuestion
  }),
  /already been recorded/
);

const secondQuestion = questionFor({ actionReport });
assert.throws(
  () => core.recordQuestion({
    taskId: actionReport.taskId,
    actionReport,
    question: secondQuestion
  }),
  /already been recorded/
);
assert.equal(
  core.auditTrail.filter(({ event }) => event === CORE_EVENTS.QUESTION_DECIDED).length,
  1
);
assert.equal(core.verifyAudit(), true);

console.log('FLUID_QUESTION_REPLAY_OK');
