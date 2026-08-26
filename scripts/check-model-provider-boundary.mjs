import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  createExecutionResult,
  ExecutorRegistry
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider
} from '../src/model-provider.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import {
  REASONING_ENGINES,
  REPRESENTATIONS,
  Task
} from '../src/representation.mjs';
import { verifyModelExecution } from '../src/verification.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/model-provider.mjs', import.meta.url));

function runner(exportName) {
  return new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName,
    timeoutMs: 2000
  });
}

const malformedProvider = new ProcessBackedModelProvider({
  runner: runner('malformed'),
  providerId: 'malformed-provider'
});
const nonObjectProvider = new ProcessBackedModelProvider({
  runner: runner('nonObject'),
  providerId: 'non-object-provider'
});
const task = new Task({
  id: 'model-boundary-task',
  description: 'Explain the architectural tradeoff in plain language'
});

assert.throws(
  () => new ProcessBackedModelProvider({ runner: {} }),
  /trusted ProcessIsolatedRunner/
);
assert.throws(
  () => malformedProvider.complete({ task, input: {} }),
  /requires non-empty text/
);
assert.throws(
  () => nonObjectProvider.complete({ task, input: {} }),
  /requires non-empty text/
);
assert.throws(
  () => malformedProvider.complete({ task: { id: task.id, description: task.description } }),
  /trusted Task/
);
assert.throws(
  () => new ModelProviderExecutor({ provider: {} }),
  /trusted model provider/
);

const validProvider = new ProcessBackedModelProvider({
  runner: runner('complete'),
  providerId: 'boundary-provider'
});
const executor = new ModelProviderExecutor({ provider: validProvider });
const strategy = {
  representation: REPRESENTATIONS.NATURAL_LANGUAGE,
  reasoningEngine: REASONING_ENGINES.LANGUAGE_MODEL
};
const honest = executor.execute({
  task,
  strategy,
  input: { question: 'What is the safe boundary?' }
});
assert.equal(verifyModelExecution(honest).passed, false);
assert.equal(verifyModelExecution(honest).deterministic, false);
assert.throws(
  () => verifyModelExecution(Object.freeze({ ...honest })),
  /produced by a registered executor/
);

class ForgedModelProviderExecutor extends ModelProviderExecutor {
  execute(request) {
    const honestExecution = super.execute(request);
    return createExecutionResult({
      ...honestExecution,
      deterministic: true,
      result: {
        ...honestExecution.result,
        text: 'forged proof'
      }
    }, this);
  }
}

const forgedHarness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    modelProviderExecutor: new ForgedModelProviderExecutor({ provider: validProvider })
  })
});
const forgedPlan = forgedHarness.plan({
  id: 'forged-model-result',
  description: 'Explain the architectural tradeoff in plain language'
});
const forgedReport = forgedHarness.execute({
  plan: forgedPlan,
  input: { question: 'Can this claim be proven?' }
});
assert.equal(forgedReport.evidence, 'OBSERVED');
assert.equal(forgedReport.verification.passed, false);
assert.equal(forgedReport.verification.deterministic, false);

console.log(
  `FLUID_MODEL_PROVIDER_BOUNDARY_OK malformedRejected=true untrustedRejected=true `
  + `semanticProofSuppressed=true forgedDeterminismRejected=true evidence=${forgedReport.evidence}`
);
