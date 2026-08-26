import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const candidate = new AgentArchitectureCandidate({
  id: 'harness-factory-benchmark-candidate',
  description: 'fresh candidate for finite factory budget benchmarking',
  plannerCandidate: fixture.plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  }),
  components: {
    planner: 'registered-process-planner',
    policy: 'bounded-v1',
    verifier: 'parent-core'
  }
});
const levels = [
  {
    id: 'benchmark-budget-low',
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  },
  {
    id: 'benchmark-budget-high',
    computeUnits: 3,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  }
];
const before = fixture.ledger.serialize();
const benchmark = fixture.factory.benchmark({
  candidate,
  cases: [fixture.evaluationCase],
  levels
});
assert.equal(isTrustedHarnessFactoryBenchmarkReport(benchmark), true);
assert.equal(Object.isFrozen(benchmark), true);
assert.equal(Object.isFrozen(benchmark.points), true);
assert.equal(Object.isFrozen(benchmark.points[0]), true);
assert.equal(benchmark.candidateId, candidate.id);
assert.equal(benchmark.caseCount, 1);
assert.deepEqual(
  benchmark.points.map(({ levelId }) => levelId),
  ['benchmark-budget-low', 'benchmark-budget-high']
);
assert.equal(benchmark.points.every(({ complete }) => complete), true);
assert.equal(benchmark.points.every(({ reproducible }) => reproducible), true);
assert.equal(benchmark.points.every(({ independent }) => independent), true);
assert.equal(benchmark.frontier.length, 1);
assert.equal(benchmark.frontier[0].levelId, 'benchmark-budget-low');
assert.equal(benchmark.frontier[0].productionSuccessRate, 1);
assert.equal(benchmark.frontier[0].productionProvenRate, 1);
assert.equal(benchmark.frontier[0].dataOnly, true);
assert.equal(benchmark.frontier[0].authorityTransferred, false);
assert.equal(benchmark.deployed, false);
assert.equal(benchmark.dataOnly, true);
assert.equal(benchmark.authorityTransferred, false);
assert.equal(Object.hasOwn(benchmark, 'candidate'), false);
assert.equal(Object.hasOwn(benchmark, 'primary'), false);
assert.equal(Object.hasOwn(benchmark, 'reproduction'), false);
assert.equal(Object.hasOwn(benchmark, 'reproducibility'), false);
assert.equal(Object.hasOwn(benchmark.points[0], 'actionReport'), false);
assert.equal(Object.hasOwn(benchmark.points[0], 'runner'), false);
assert.equal(fixture.ledger.serialize(), before);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_OK `
  + `levels=${benchmark.points.length} complete=${benchmark.complete} `
  + `reproducible=${benchmark.reproducible} independent=${benchmark.independent} `
  + `frontier=${benchmark.frontier.map(({ levelId }) => levelId).join(',')} `
  + `candidate=${benchmark.candidateId} ledgerUnchanged=${fixture.ledger.serialize() === before} `
  + `dataOnly=${benchmark.dataOnly} authorityTransferred=${benchmark.authorityTransferred}`
);
