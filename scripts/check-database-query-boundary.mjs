import assert from 'node:assert/strict';

import {
  createExecutionResult,
  DatabaseQueryExecutor,
  ExecutorRegistry
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyDatabaseQueryExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.DATABASE_QUERY,
  reasoningEngine: REASONING_ENGINES.QUERY_PLANNER
};
const task = { id: 'database-query-boundary-task' };
const validInput = {
  rows: [
    { id: 'a', status: 'open', score: 3 },
    { id: 'b', status: 'closed', score: 9 }
  ],
  filter: { field: 'status', equals: 'open' },
  select: ['id', 'score'],
  sort: { field: 'score', direction: 'desc' },
  limit: 1
};
const executor = new DatabaseQueryExecutor();

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({ ...validInput, rows: [] }),
  /1-64 rows/
);
assert.throws(
  () => execute({ ...validInput, select: ['id', 'id'] }),
  /unique/
);
assert.throws(
  () => execute({ ...validInput, select: ['missing'] }),
  /exist in every row/
);
assert.throws(
  () => execute({ ...validInput, sort: { field: 'score', direction: 'sideways' } }),
  /asc or desc/
);
assert.throws(
  () => execute({
    ...validInput,
    rows: [{ id: 'a', status: 'open', score: 3, active: true }, { id: 'b', status: 'closed', score: 9 }],
    select: ['id']
  }),
  /one field schema/
);
assert.throws(
  () => execute({ ...validInput, limit: 65 }),
  /must not exceed 64/
);
assert.throws(
  () => execute({
    ...validInput,
    rows: [{ id: 'a', status: 'open', score: { value: 3 } }]
  }),
  /scalar/
);
const getterRow = { id: 'a', status: 'open', score: 3 };
Object.defineProperty(getterRow, 'status', {
  enumerable: true,
  get: () => 'open'
});
assert.throws(
  () => execute({ ...validInput, rows: [getterRow] }),
  /enumerable data properties/
);

const honest = execute(validInput);
assert.equal(verifyDatabaseQueryExecution(honest).passed, true);
assert.throws(
  () => verifyDatabaseQueryExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedDatabaseExecutor extends DatabaseQueryExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        rows: [{ id: 'forged', score: 999 }]
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new ForgedDatabaseExecutor()] })
});
const forgedPlan = forgedHarness.plan({
  id: 'database-query-forged-result',
  description: 'Run a database query over records'
});
const forgedReport = forgedHarness.execute({ plan: forgedPlan, input: validInput });
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, 'PROVEN');

console.log(
  `FLUID_DATABASE_QUERY_BOUNDARY_OK invalidInputRejected=true getterRejected=true `
  + `untrustedRejected=true forgedProofRejected=true evidence=${forgedReport.evidence}`
);
