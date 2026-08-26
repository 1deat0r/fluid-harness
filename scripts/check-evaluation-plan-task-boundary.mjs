import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const harness = new FluidHarness();
const donorPlan = harness.plan({
  id: 'donor-plan-task',
  description: 'Find a graph path'
});
const report = new EvaluationRunner({
  harness,
  plan: () => donorPlan
}).evaluate({
  candidateId: 'evaluation-plan-task-boundary',
  cases: [new EvaluationCase({
    id: 'evaluation-plan-task-case',
    domain: 'graph',
    task: {
      id: 'evaluation-case-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport.result.path.join('>') === 'A>B'
  })],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.successRate, 0);
assert.match(report.results[0].error, /plan.*task/i);

console.log('FLUID_EVALUATION_PLAN_TASK_BOUNDARY_OK');
