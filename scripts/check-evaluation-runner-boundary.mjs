import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';
import { SURPRISE_BANDS } from '../src/world-model.mjs';

assert.throws(
  () => new EvaluationRunner({
    harness: {
      plan: () => ({}),
      execute: () => ({})
    }
  }),
  /requires a FluidHarness/
);

const runner = new EvaluationRunner({
  harness: new FluidHarness(),
  execute: () => ({
    evidence: EVIDENCE_LEVELS.PROVEN,
    surpriseNats: 0,
    surpriseBand: SURPRISE_BANDS.LOW,
    strategy: { representation: REPRESENTATIONS.GRAPH },
    result: { forged: true },
    verification: { verifierId: 'forged-verifier' }
  })
});
const report = runner.evaluate({
  candidateId: 'untrusted-evaluation-boundary',
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 }),
  cases: [new EvaluationCase({
    id: 'untrusted-evaluation-boundary-case',
    domain: 'boundary',
    task: { id: 'untrusted-evaluation-boundary-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (actionReport) => actionReport?.result?.forged === true
  })]
});

assert.equal(report.provenRate, 0);
assert.equal(report.successRate, 0);
assert.match(report.results[0].error, /action report from the current Plan/);

console.log('FLUID_EVALUATION_RUNNER_BOUNDARY_OK');
