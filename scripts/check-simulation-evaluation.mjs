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
  id: 'simulation-evaluation-case',
  domain: 'simulation',
  adversarial: true,
  task: {
    id: 'simulation-evaluation-task',
    description: 'Simulate a finite state-machine scenario'
  },
  input: {
    states: ['idle', 'running', 'done'],
    initialState: 'idle',
    transitions: [
      { from: 'idle', event: 'start', to: 'running' },
      { from: 'running', event: 'finish', to: 'done' }
    ],
    events: ['start', 'finish']
  },
  expected: (report) => (
    report.strategy.representation === 'simulation'
    && report.result.completed === true
    && report.result.finalState === 'done'
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'simulation-kernel',
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
  assert.equal(report.results[0].verifierId, 'finite-state-simulation-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_SIMULATION_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
