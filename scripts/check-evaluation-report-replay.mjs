import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const harness = new FluidHarness();
const plan = harness.plan({ id: 'evaluation-report-replay', description: 'Find a graph path' });
const actionReport = harness.execute({ plan, input });
let executeCalls = 0;
const evaluationCase = new EvaluationCase({
  id: 'evaluation-report-replay-case',
  domain: 'boundary',
  task: { id: 'evaluation-report-replay', description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const options = {
  candidateId: 'evaluation-report-replay',
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
};
const runner = new EvaluationRunner({
  harness,
  plan: () => plan,
  execute: () => {
    executeCalls += 1;
    return actionReport;
  }
});

const first = runner.evaluate(options);
assert.equal(first.successRate, 1);

const replay = runner.evaluate(options);
assert.equal(replay.successRate, 0);
assert.match(replay.results[0].error, /already-consumed action report/);

const secondRunner = new EvaluationRunner({
  harness,
  plan: () => plan,
  execute: () => actionReport
});
const crossRunnerReplay = secondRunner.evaluate(options);
assert.equal(crossRunnerReplay.successRate, 0);
assert.match(crossRunnerReplay.results[0].error, /consumed by another evaluation runner/);
assert.equal(executeCalls, 2);

console.log('FLUID_EVALUATION_REPORT_REPLAY_OK');
