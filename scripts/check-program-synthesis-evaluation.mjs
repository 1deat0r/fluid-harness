import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const evaluationCase = new EvaluationCase({
  id: 'program-synthesis-evaluation-case',
  domain: 'program-synthesis',
  adversarial: true,
  task: {
    id: 'program-synthesis-evaluation-task',
    description: 'Implement a function from arithmetic examples'
  },
  input: {
    variables: ['x'],
    constants: [1],
    operators: ['add'],
    maxDepth: 1,
    examples: [
      { inputs: { x: 1 }, output: 2 },
      { inputs: { x: 3 }, output: 4 }
    ]
  },
  expected: (report) => (
    report.strategy.representation === 'program-synthesis'
    && report.result.expression?.op === 'add'
    && report.result.examplesChecked === 2
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'program-synthesis-kernel',
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
}

const production = evaluate(POLICY_MODES.PRODUCTION);
const research = evaluate(POLICY_MODES.RESEARCH);
const skeptic = evaluate(POLICY_MODES.SKEPTIC);
for (const report of [production, research, skeptic]) {
  assert.equal(report.complete, true);
  assert.equal(report.successRate, 1);
  assert.equal(report.provenRate, 1);
  assert.equal(report.results[0].verifierId, 'finite-program-synthesis-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_PROGRAM_SYNTHESIS_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
