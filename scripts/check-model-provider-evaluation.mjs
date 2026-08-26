import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { ExecutorRegistry } from '../src/executor.mjs';
import {
  ModelProviderExecutor,
  ProcessBackedModelProvider
} from '../src/model-provider.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';
import { FluidHarness } from '../src/harness.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/model-provider.mjs', import.meta.url));
const evaluationCase = new EvaluationCase({
  id: 'model-provider-evaluation-case',
  domain: 'natural-language',
  adversarial: true,
  requiresProof: false,
  task: {
    id: 'model-provider-evaluation-task',
    description: 'Explain the architectural tradeoff in plain language'
  },
  input: {
    question: 'Why should deterministic work use a deterministic engine?'
  },
  expected: (report) => (
    report.strategy.representation === 'natural-language'
    && report.result.providerId === 'evaluation-provider'
    && report.result.text.includes('architectural tradeoff')
  )
});

function harnessWithProvider() {
  const runner = new ProcessIsolatedRunner({
    modulePath: fixturePath,
    exportName: 'complete',
    timeoutMs: 2000
  });
  const provider = new ProcessBackedModelProvider({
    runner,
    providerId: 'evaluation-provider',
    modelId: 'evaluation-model'
  });
  return new FluidHarness({
    executorRegistry: new ExecutorRegistry({
      modelProviderExecutor: new ModelProviderExecutor({ provider })
    })
  });
}

function evaluate(mode) {
  return new EvaluationRunner({ harness: harnessWithProvider() }).evaluate({
    candidateId: 'observed-model-provider',
    cases: [evaluationCase],
    mode,
    budget: new EvaluationBudget({ maxCases: 1 })
  });
}

const production = evaluate(POLICY_MODES.PRODUCTION);
const research = evaluate(POLICY_MODES.RESEARCH);
const skeptic = evaluate(POLICY_MODES.SKEPTIC);
for (const report of [production, research, skeptic]) {
  assert.equal(report.complete, true);
  assert.equal(report.successRate, 1);
  assert.equal(report.provenRate, null);
  assert.equal(report.results[0].proven, false);
  assert.equal(report.results[0].verifierId, 'model-response-observer/v1');
}

const decision = new PromotionAuthority().decide(research, {
  productionReport: production,
  skepticReport: skeptic
});
assert.equal(decision.promoted, false);
assert.ok(decision.reasons.some((reason) => reason.includes('proven rate null')));

console.log(
  `FLUID_MODEL_PROVIDER_EVALUATION_OK production=${production.successRate} `
  + `research=${research.successRate} skeptic=${skeptic.successRate} `
  + `proven=${research.provenRate} promoted=${decision.promoted}`
);
