import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS } from '../src/representation.mjs';

const harness = new FluidHarness();
const plan = harness.plan({
  id: 'database-query-check',
  description: 'Run a database query over customer records'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.DATABASE_QUERY);
const report = harness.execute({
  plan,
  input: {
    rows: [
      { id: 'a', status: 'open', score: 3 },
      { id: 'b', status: 'closed', score: 9 },
      { id: 'c', status: 'open', score: 7 }
    ],
    filter: { field: 'status', equals: 'open' },
    select: ['id', 'score'],
    sort: { field: 'score', direction: 'desc' },
    limit: 2
  },
  reproduction: 'node scripts/check-database-query.mjs'
});

assert.deepEqual(report.result.rows, [
  { id: 'c', score: 7 },
  { id: 'a', score: 3 }
]);
assert.equal(report.result.matchedRows, 2);
assert.equal(report.result.returnedRows, 2);
assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(report.verification.verifierId, 'database-query-verifier/v1');
assert.equal(report.verification.passed, true);
assert.equal(report.verification.checks.every(({ passed }) => passed), true);

console.log(
  `FLUID_DATABASE_QUERY_OK representation=${plan.strategy.representation} `
  + `matched=${report.result.matchedRows} returned=${report.result.returnedRows} `
  + `evidence=${report.evidence} verifier=${report.verification.verifierId}`
);
