import assert from 'node:assert/strict';

import {
  createExecutionResult,
  ExecutorRegistry,
  ProgramSynthesisExecutor
} from '../src/executor.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  REASONING_ENGINES,
  REPRESENTATIONS
} from '../src/representation.mjs';
import { verifyProgramSynthesisExecution } from '../src/verification.mjs';

const strategy = {
  representation: REPRESENTATIONS.PROGRAM_SYNTHESIS,
  reasoningEngine: REASONING_ENGINES.PROGRAM_SYNTHESIS
};
const task = { id: 'program-synthesis-boundary-task' };
const validInput = {
  variables: ['x'],
  constants: [1],
  operators: ['add'],
  maxDepth: 1,
  examples: [
    { inputs: { x: 1 }, output: 2 },
    { inputs: { x: 2 }, output: 3 }
  ]
};
const executor = new ProgramSynthesisExecutor();

function execute(input, executionOptions = {}) {
  return executor.execute({ task, strategy, input, executionOptions });
}

assert.throws(
  () => execute({ ...validInput, operators: ['divide'] }),
  /must be add, subtract, or multiply/
);
assert.throws(
  () => execute({ ...validInput, variables: ['x', 'x'] }),
  /must be unique/
);
assert.throws(
  () => execute({
    ...validInput,
    examples: [{ inputs: { y: 1 }, output: 2 }]
  }),
  /must match variables/
);
assert.throws(
  () => execute({ ...validInput, maxDepth: 5 }),
  /must not exceed 4/
);
assert.throws(
  () => execute(validInput, { maxCandidates: 0 }),
  /positive.*integer/
);

const honest = execute(validInput);
assert.equal(verifyProgramSynthesisExecution(honest).passed, true);
assert.throws(
  () => verifyProgramSynthesisExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

const limitedHarness = new FluidHarness();
const limitedPlan = limitedHarness.plan({
  id: 'program-synthesis-resource-limit',
  description: 'Implement a function from arithmetic examples'
});
const limitedReport = limitedHarness.execute({
  plan: limitedPlan,
  input: validInput,
  executionOptions: { maxCandidates: 1 }
});
assert.equal(limitedReport.result.synthesisComplete, false);
assert.equal(limitedReport.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(limitedReport.verification.passed, false);

class ForgedProgramSynthesisExecutor extends ProgramSynthesisExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      result: {
        ...honestExecution.result,
        expression: { op: 'var', name: 'x' },
        expressionKey: '{"op":"var","name":"x"}',
        depth: 0
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    executors: [new ForgedProgramSynthesisExecutor()]
  })
});
const forgedPlan = forgedHarness.plan({
  id: 'program-synthesis-forged-result',
  description: 'Implement a function from arithmetic examples'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: validInput
});
assert.equal(forgedReport.verification.passed, false);
assert.notEqual(forgedReport.evidence, EVIDENCE_LEVELS.PROVEN);

console.log(
  `FLUID_PROGRAM_SYNTHESIS_BOUNDARY_OK malformedRejected=true `
  + `resourceLimitObserved=${limitedReport.evidence === EVIDENCE_LEVELS.OBSERVED} `
  + `untrustedRejected=true forgedProgramRejected=${forgedReport.verification.passed === false} `
  + `evidence=${forgedReport.evidence}`
);
