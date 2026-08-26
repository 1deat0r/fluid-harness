import assert from 'node:assert/strict';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { questionFor } from '../src/curiosity.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const preCorePlan = harness.plan({
  id: 'question-core-ownership-pre-core-task',
  description: 'Find a graph path'
});
const preCoreAction = harness.execute({
  plan: preCorePlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
const core = new ConstitutionalCore({ harness });
const preCoreQuestion = questionFor({ actionReport: preCoreAction });

assert.throws(
  () => core.recordQuestion({
    taskId: preCoreAction.taskId,
    actionReport: preCoreAction,
    question: preCoreQuestion
  }),
  /action report produced by this core/
);
assert.equal(core.status.actionsUsed, 0);
assert.equal(core.auditTrail.length, 0);
assert.equal(core.verifyAudit(), true);

const validCore = new ConstitutionalCore();
const validPlan = validCore.plan({
  id: 'question-core-ownership-valid-task',
  description: 'Find a graph path'
});
const validAction = validCore.execute({
  plan: validPlan,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  }
});
validCore.recordQuestion({
  taskId: validAction.taskId,
  actionReport: validAction,
  question: questionFor({ actionReport: validAction })
});
assert.equal(validCore.auditTrail.at(-1).event, 'question-decided');
assert.equal(validCore.verifyAudit(), true);

console.log('FLUID_QUESTION_CORE_OWNERSHIP_OK');
