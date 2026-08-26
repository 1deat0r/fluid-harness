import assert from 'node:assert/strict';

import {
  CognitiveCycleReport,
  isTrustedCycleReport
} from '../src/cycle.mjs';
import { ConstitutionalCore } from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';

const core = new ConstitutionalCore();
const plan = core.plan({
  id: 'cycle-freeze-boundary-task',
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
const questionDecision = questionFor({
  actionReport,
  researchCompleted: false
});
core.recordQuestion({
  taskId: actionReport.taskId,
  actionReport,
  question: questionDecision
});

const originalFreeze = Object.freeze;
let cycle;
try {
  Object.freeze = (value) => value;
  cycle = new CognitiveCycleReport({
    plan,
    actionReport,
    core,
    questionDecision
  });
} finally {
  Object.freeze = originalFreeze;
}

assert.equal(Object.isFrozen(cycle), true);
assert.equal(isTrustedCycleReport(cycle), false);

console.log('FLUID_CYCLE_FREEZE_BOUNDARY_OK');
