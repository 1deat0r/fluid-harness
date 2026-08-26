import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { ConstitutionalCore } from '../src/constitution.mjs';
import { CognitiveCycleRunner, isTrustedCycleReport } from '../src/cycle.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider
} from '../src/model-provider.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/model-provider.mjs', import.meta.url));
const provider = new ProcessBackedModelProvider({
  runner: new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'complete',
    timeoutMs: 2000
  }),
  providerId: 'cycle-provider',
  modelId: 'cycle-model'
});
const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({
    modelProviderExecutor: new ModelProviderExecutor({ provider })
  })
});
const core = new ConstitutionalCore({ harness });
const cycle = new CognitiveCycleRunner({ core }).run({
  task: {
    id: 'model-provider-cycle',
    description: 'Explain the architectural tradeoff in plain language'
  },
  input: {
    question: 'What does this model-provider boundary prove?'
  },
  reproduction: 'node scripts/check-model-provider-cycle.mjs'
});

assert.equal(isTrustedCycleReport(cycle), true);
assert.equal(cycle.stages.represent.representation, 'natural-language');
assert.equal(cycle.stages.represent.executionSubstrate, 'model-provider');
assert.match(cycle.stages.act.result.text, /architectural tradeoff/);
assert.equal(cycle.stages.verify.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(cycle.stages.verify.verifierId, 'model-response-observer/v1');
assert.equal(cycle.stages.preserve.coreAuditValid, true);

console.log(
  `FLUID_MODEL_PROVIDER_CYCLE_OK representation=${cycle.stages.represent.representation} `
  + `evidence=${cycle.stages.verify.evidence} verifier=${cycle.stages.verify.verifierId} `
  + `audit=${cycle.stages.preserve.coreAuditValid}`
);
