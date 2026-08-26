import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import { ExecutorRegistry } from '../src/executor.mjs';
import { FluidHarness, isTrustedActionReport } from '../src/harness.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider,
  MODEL_PROVIDER_SOURCES
} from '../src/model-provider.mjs';
import { EXECUTION_SUBSTRATES, REPRESENTATIONS } from '../src/representation.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/model-provider.mjs', import.meta.url));
const runner = new (await import('../src/process-boundary.mjs')).ProcessIsolatedRunner({
  modulePath: fixturePath,
  exportName: 'complete',
  timeoutMs: 2000
});
const provider = new ProcessBackedModelProvider({
  runner,
  providerId: 'fixture-provider',
  modelId: 'fixture-model'
});
const modelExecutor = new ModelProviderExecutor({ provider });
const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ modelProviderExecutor: modelExecutor })
});
const plan = harness.plan({
  id: 'model-provider-check',
  description: 'Explain the architectural tradeoff in plain language'
});
const report = harness.execute({
  plan,
  input: { question: 'Why should deterministic work use a deterministic engine?' },
  executionOptions: {
    modelContext: { audience: 'beginner' }
  },
  reproduction: 'node scripts/check-model-provider.mjs'
});

assert.equal(plan.strategy.representation, REPRESENTATIONS.NATURAL_LANGUAGE);
assert.equal(plan.strategy.executionSubstrate, EXECUTION_SUBSTRATES.MODEL_PROVIDER);
assert.equal(report.result.providerId, 'fixture-provider');
assert.equal(report.result.modelId, 'fixture-model');
assert.equal(report.result.source, MODEL_PROVIDER_SOURCES.PROCESS_ISOLATED);
assert.match(report.result.text, /architectural tradeoff/);
assert.equal(report.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(report.verification.verifierId, 'model-response-observer/v1');
assert.equal(report.verification.passed, false);
assert.equal(report.verification.deterministic, false);
assert.equal(isTrustedActionReport(report, harness), true);
assert.ok(report.verification.checks.some(({ id, passed }) => id === 'semantic-proof' && !passed));

console.log(
  `FLUID_MODEL_PROVIDER_OK representation=${plan.strategy.representation} `
  + `source=${report.result.source} evidence=${report.evidence} `
  + `verifier=${report.verification.verifierId} proof=${report.verification.passed}`
);
