import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import {
  FluidHarness,
  isTrustedActionReport
} from '../src/harness.mjs';

const donorInput = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const targetInput = {
  nodes: ['A', 'B', 'C'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const harness = new FluidHarness();
const core = new ConstitutionalCore({
  constitution: new Constitution({ maxActions: 2, maxAuditEntries: 32 }),
  harness
});
const donorPlan = core.plan({ id: 'input-replay-boundary-plan', description: 'Find a graph path' });
const donorReport = harness.execute({ plan: donorPlan, input: donorInput });

assert.equal(isTrustedActionReport(donorReport, harness, donorPlan, donorInput), true);
assert.equal(isTrustedActionReport(donorReport, harness, donorPlan, targetInput), false);

harness.execute = () => donorReport;
assert.throws(
  () => core.execute({ plan: donorPlan, input: targetInput }),
  /matching the current plan/
);

const evaluationHarness = new FluidHarness();
const evaluationRunner = new EvaluationRunner({
  harness: evaluationHarness,
  execute: ({ plan }) => evaluationHarness.execute({ plan, input: donorInput })
});
const evaluation = evaluationRunner.evaluate({
  candidateId: 'input-replay-boundary',
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 }),
  cases: [new EvaluationCase({
    id: 'input-replay-boundary-case',
    domain: 'boundary',
    task: { id: 'input-replay-boundary-task', description: 'Find a graph path' },
    input: targetInput,
    expected: (report) => report?.result?.path?.join('>') === 'A>B'
  })]
});
assert.equal(evaluation.provenRate, 0);
assert.match(evaluation.results[0].error, /action report from the current Plan/);

console.log('FLUID_ACTION_REPORT_INPUT_REPLAY_OK');
