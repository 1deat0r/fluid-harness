import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const runner = new EvaluationRunner({
  harness: new FluidHarness(),
  execute: () => Object.freeze({
    evidence: 'PROVEN',
    result: { proved: true, counterexample: null },
    strategy: { representation: 'theorem' },
    verification: { verifierId: 'forged-theorem-verifier' }
  })
});
const report = runner.evaluate({
  candidateId: 'forged-theorem-kernel',
  cases: [new EvaluationCase({
    id: 'forged-theorem-case',
    domain: 'formal-reasoning',
    task: {
      id: 'forged-theorem-task',
      description: 'Prove a formal theorem'
    },
    input: {
      variables: ['p'],
      assumptions: [{ op: 'var', name: 'p' }],
      conclusion: { op: 'var', name: 'p' }
    },
    expected: () => true
  })],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.successRate, 0);
assert.equal(report.provenRate, 0);
assert.equal(report.results[0].representation, null);
assert.match(report.results[0].error, /current Plan/);

console.log(
  `FLUID_THEOREM_EVALUATION_BOUNDARY_OK forgedActionRejected=true `
  + `successRate=${report.successRate} provenRate=${report.provenRate}`
);
