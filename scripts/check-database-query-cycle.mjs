import assert from 'node:assert/strict';

import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cycle = new CognitiveCycleRunner().run({
  task: {
    id: 'database-query-cycle',
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
  reproduction: 'node scripts/check-database-query-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'database-query');
assert.equal(cycle.stages.represent.reasoningEngine, 'query-planner');
assert.deepEqual(cycle.stages.act.result.rows, [{ id: 'c', score: 7 }]);
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.PROVEN);
assert.equal(cycle.stages.verify.verifierId, 'database-query-verifier/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);
assert.equal(cycle.stages.preserve.productionPreserved, true);

console.log(
  `FLUID_DATABASE_QUERY_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `evidence=${cycle.stages.verify.evidence} verifier=${cycle.stages.verify.verifierId} `
  + `audit=${cycle.stages.preserve.coreAuditValid}`
);
