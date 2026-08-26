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
    result: { selectedId: 'fast', selectedValue: 2 },
    strategy: { representation: 'optimization' },
    verification: { verifierId: 'forged-optimization-verifier' }
  })
});
const report = runner.evaluate({
  candidateId: 'forged-optimization-kernel',
  cases: [new EvaluationCase({
    id: 'forged-optimization-case',
    domain: 'optimization',
    task: {
      id: 'forged-optimization-task',
      description: 'Optimize a finite candidate set'
    },
    input: {
      objective: 'minimize',
      candidates: [{ id: 'fast', value: 2 }]
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
  `FLUID_OPTIMIZATION_EVALUATION_BOUNDARY_OK forgedActionRejected=true `
  + `successRate=${report.successRate} provenRate=${report.provenRate}`
);
