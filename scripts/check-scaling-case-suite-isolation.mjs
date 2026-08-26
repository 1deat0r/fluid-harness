import assert from 'node:assert/strict';

import {
  EvaluationCase,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { ScalingRunner } from '../src/scaling.mjs';

const cases = [1, 2].map((number) => new EvaluationCase({
  id: `scaling-case-suite-${number}`,
  domain: 'graph',
  task: {
    id: `scaling-case-suite-${number}-task`,
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
}));

class MutatingSelector {
  constructor(caseSuite) {
    this.caseSuite = caseSuite;
    this.calls = 0;
  }

  select() {
    if (this.calls === 0) {
      this.caseSuite.pop();
    }
    this.calls += 1;
    return REPRESENTATIONS.GRAPH;
  }
}

const curve = new ScalingRunner({
  harnessFactory: () => new FluidHarness({ selector: new MutatingSelector(cases) })
}).evaluate({
  candidateId: 'scaling-case-suite-isolation',
  cases,
  mode: POLICY_MODES.RESEARCH,
  levels: [
    { id: 'level-one', computeUnits: 1 },
    { id: 'level-two', computeUnits: 2 }
  ]
});

assert.deepEqual(curve.points.map(({ eligibleCases }) => eligibleCases), [2, 2]);
assert.deepEqual(curve.points.map(({ attemptedCases }) => attemptedCases), [2, 2]);
assert.deepEqual(curve.points.map(({ successRate }) => successRate), [1, 1]);

console.log('FLUID_SCALING_CASE_SUITE_ISOLATION_OK');
