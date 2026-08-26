import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const forgedActionReport = Object.freeze({
  evidence: 'PROVEN',
  result: { rows: [{ id: 'forged' }] },
  strategy: { representation: 'database-query' },
  verification: { verifierId: 'forged-database-verifier' }
});
const runner = new EvaluationRunner({
  harness: new FluidHarness(),
  execute: () => forgedActionReport
});
const report = runner.evaluate({
  candidateId: 'forged-database-query-kernel',
  cases: [new EvaluationCase({
    id: 'forged-database-query-case',
    domain: 'database',
    task: {
      id: 'forged-database-query-task',
      description: 'Run a database query over records'
    },
    input: {
      rows: [{ id: 'a', status: 'open', score: 1 }],
      filter: null,
      select: ['id'],
      sort: null,
      limit: 1
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
  `FLUID_DATABASE_QUERY_EVALUATION_BOUNDARY_OK forgedActionRejected=true `
  + `successRate=${report.successRate} provenRate=${report.provenRate}`
);
