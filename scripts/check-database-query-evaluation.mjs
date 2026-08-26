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
  id: 'database-query-evaluation-case',
  domain: 'database',
  adversarial: true,
  task: {
    id: 'database-query-evaluation-task',
    description: 'Run a database query over customer records'
  },
  input: {
    rows: [
      { id: 'a', status: 'open', score: 3 },
      { id: 'b', status: 'closed', score: 9 },
      { id: 'c', status: 'open', score: 7 }
    ],
    filter: { field: 'status', equals: 'open' },
    select: ['id', 'score'],
    sort: { field: 'score', direction: 'desc' },
    limit: 1
  },
  expected: (report) => (
    report.strategy.representation === 'database-query'
    && report.result.rows.length === 1
    && report.result.rows[0].id === 'c'
    && report.result.rows[0].score === 7
  )
});

function evaluate(mode) {
  return new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
    candidateId: 'database-query-kernel',
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
  assert.equal(report.results[0].verifierId, 'database-query-verifier/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, true);

console.log(
  `FLUID_DATABASE_QUERY_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
