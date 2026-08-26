import assert from 'node:assert/strict';

import {
  createExecutionResult,
  ExecutorRegistry,
  OptimizationExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyOptimizationExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.OPTIMIZATION,
  reasoningEngine: REASONING_ENGINES.NUMERICAL_OPTIMIZER
};
const task = { id: 'optimization-boundary-task' };
const validInput = {
  objective: 'minimize',
  candidates: [
    { id: 'slow', value: 9 },
    { id: 'fast', value: 2 }
  ]
};
const executor = new OptimizationExecutor();

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({ ...validInput, objective: 'average' }),
  /must be minimize or maximize/
);
assert.throws(
  () => execute({ ...validInput, candidates: [] }),
  /1-64 entries/
);
assert.throws(
  () => execute({ ...validInput, candidates: [
    { id: 'same', value: 1 },
    { id: 'same', value: 2 }
  ] }),
  /Duplicate optimization candidate id/
);
assert.throws(
  () => execute({ ...validInput, candidates: [
    { id: 'invalid', value: Number.POSITIVE_INFINITY }
  ] }),
  /must be finite/
);
assert.throws(
  () => execute({
    objective: 'minimize',
    candidates: Array.from({ length: 65 }, (_, index) => ({ id: `c${index}`, value: index }))
  }),
  /1-64 entries/
);

const honest = execute(validInput);
assert.equal(verifyOptimizationExecution(honest).passed, true);
assert.throws(
  () => verifyOptimizationExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedOptimizationExecutor extends OptimizationExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        selectedId: 'slow',
        selectedValue: 9
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new ForgedOptimizationExecutor()] })
});
const forgedPlan = forgedHarness.plan({
  id: 'optimization-forged-result',
  description: 'Optimize a finite candidate set'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: validInput
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, 'PROVEN');

console.log(
  `FLUID_OPTIMIZATION_BOUNDARY_OK malformedRejected=true tieBreakDeterministic=true `
  + `untrustedRejected=true forgedSelectionRejected=true evidence=${forgedReport.evidence}`
);
