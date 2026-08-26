import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import { CognitiveCycleReport } from '../src/cycle.mjs';
import { questionFor } from '../src/curiosity.mjs';

function createCore() {
  return new ConstitutionalCore({
    constitution: new Constitution({ maxActions: 4, maxAuditEntries: 32 })
  });
}

function execute(core, id) {
  const plan = core.plan({ id, description: 'Find a graph path' });
  const actionReport = core.execute({
    plan,
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    }
  });
  return { plan, actionReport };
}

const source = createCore();
const first = execute(source, 'cycle-boundary-first');
const second = execute(source, 'cycle-boundary-second');
const target = createCore();
const targetPair = execute(target, 'cycle-boundary-target');
const targetQuestion = questionFor({ actionReport: targetPair.actionReport });
target.recordQuestion({
  taskId: targetPair.actionReport.taskId,
  actionReport: targetPair.actionReport,
  question: targetQuestion
});

assert.throws(
  () => new CognitiveCycleReport({
    plan: first.plan,
    actionReport: first.actionReport,
    core: target
  }),
  /owned by the supplied core/
);
assert.throws(
  () => new CognitiveCycleReport({
    plan: first.plan,
    actionReport: second.actionReport,
    core: source
  }),
  /tasks must match/
);
assert.throws(
  () => new CognitiveCycleReport({
    plan: second.plan,
    actionReport: second.actionReport,
    core: source,
    questionDecision: questionFor({ actionReport: first.actionReport })
  }),
  /trusted for the action report/
);

const valid = new CognitiveCycleReport({
  plan: targetPair.plan,
  actionReport: targetPair.actionReport,
  core: target,
  questionDecision: targetQuestion
});
assert.equal(valid.taskId, targetPair.plan.task.id);

console.log('FLUID_CYCLE_BOUNDARY_OK');
