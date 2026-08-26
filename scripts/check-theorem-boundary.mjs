import assert from 'node:assert/strict';

import {
  createExecutionResult,
  ExecutorRegistry,
  TheoremExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import { REPRESENTATIONS, REASONING_ENGINES } from '../src/representation.mjs';
import { verifyTheoremExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.THEOREM,
  reasoningEngine: REASONING_ENGINES.THEOREM_PROVER
};
const task = { id: 'theorem-boundary-task' };
const validInput = {
  variables: ['p'],
  assumptions: [{ op: 'var', name: 'p' }],
  conclusion: { op: 'var', name: 'p' }
};
const executor = new TheoremExecutor();

function execute(input) {
  return executor.execute({ task, strategy, input });
}

assert.throws(
  () => execute({ ...validInput, variables: ['p', 'p'] }),
  /unique/
);
assert.throws(
  () => execute({
    ...validInput,
    assumptions: [{ op: 'var', name: 'missing' }]
  }),
  /undeclared variable/
);
assert.throws(
  () => execute({ ...validInput, conclusion: { op: 'xor', args: [] } }),
  /Unsupported theorem formula operation/
);
assert.throws(
  () => execute({ ...validInput, variables: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }),
  /1-8 names/
);
assert.throws(
  () => execute({
    ...validInput,
    conclusion: {
      op: 'not',
      arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'not', arg: { op: 'var', name: 'p' } } } } } } } } }
    }
  }),
  /depth/
);

const honest = execute(validInput);
assert.equal(verifyTheoremExecution(honest).passed, true);
assert.throws(
  () => verifyTheoremExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedTheoremExecutor extends TheoremExecutor {
  execute(request) {
    const honestExecution = super.execute({
      ...request,
      input: {
        variables: ['p'],
        assumptions: [{ op: 'var', name: 'p' }],
        conclusion: { op: 'false' }
      }
    });
    return createExecutionResult({
      ...honestExecution,
      observation: 'theorem refuted',
      result: {
        ...honestExecution.result,
        proved: true,
        counterexample: null
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new ForgedTheoremExecutor()] })
});
const forgedPlan = forgedHarness.plan({
  id: 'theorem-forged-result',
  description: 'Prove a formal theorem'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: {
    variables: ['p'],
    assumptions: [{ op: 'var', name: 'p' }],
    conclusion: { op: 'false' }
  }
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, 'PROVEN');

console.log(
  `FLUID_THEOREM_BOUNDARY_OK malformedRejected=true depthRejected=true `
  + `untrustedRejected=true forgedProofRejected=true evidence=${forgedReport.evidence}`
);
