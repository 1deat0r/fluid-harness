import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function candidateFor(fixture, policyFactory = () => new AgentPolicy({
  maxEpisodes: 2,
  maxToolCallsPerEpisode: 2
})) {
  return new AgentArchitectureCandidate({
    id: 'harness-factory-benchmark-boundary-candidate',
    description: 'fresh benchmark boundary candidate',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory,
    components: { mode: 'bounded' }
  });
}

function validLevel(id = 'benchmark-boundary-level', computeUnits = 1) {
  return {
    id,
    computeUnits,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create archived evidence for benchmark boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const candidate = candidateFor(fixture);
const validOptions = {
  candidate,
  cases: [fixture.evaluationCase],
  levels: [validLevel()]
};
const report = fixture.factory.benchmark(validOptions);
const before = fixture.ledger.serialize();
assert.equal(isTrustedHarnessFactoryBenchmarkReport(report), true);
assert.equal(isTrustedHarnessFactoryBenchmarkReport(Object.freeze({ ...report })), false);
assert.equal(isTrustedHarnessFactoryBenchmarkReport(new Proxy(report, {})), false);

assert.throws(
  () => fixture.factory.benchmark({}),
  /requires a trusted architecture candidate|requires cases|requires levels/
);
assert.throws(
  () => fixture.factory.benchmark({ ...validOptions, extra: true }),
  /only enumerable data properties/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'candidate', {
  enumerable: true,
  get: () => candidate
});
assert.throws(
  () => fixture.factory.benchmark(accessorOptions),
  /only enumerable data properties/
);
for (const levels of [[], [validLevel(), validLevel('duplicate')], [validLevel('a', 1), validLevel('b', 1)]]) {
  assert.throws(
    () => fixture.factory.benchmark({ ...validOptions, levels }),
    /requires levels|must be unique/
  );
}
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    levels: Array.from({ length: 9 }, (_, index) => validLevel(`too-many-${index}`, index + 1))
  }),
  /cannot exceed/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    levels: [{ ...validLevel(), unexpected: true }]
  }),
  /only enumerable data properties/
);
const accessorLevel = {};
Object.defineProperty(accessorLevel, 'id', {
  enumerable: true,
  get: () => 'accessor-level'
});
assert.throws(
  () => fixture.factory.benchmark({ ...validOptions, levels: [accessorLevel] }),
  /only enumerable data properties/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    levels: [{
      ...validLevel(),
      productionBudget: { maxCases: 1 }
    }]
  }),
  /trusted EvaluationBudget/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    cases: [Object.create(Object.getPrototypeOf(fixture.evaluationCase))]
  }),
  /trusted planner cases/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    cases: [fixture.evaluationCase, fixture.evaluationCase]
  }),
  /case ids must be unique/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    candidate: Object.freeze({ ...candidate })
  }),
  /trusted architecture candidate/
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    candidate: new Proxy(candidate, {})
  }),
  /trusted architecture candidate/
);
const disposedCandidate = candidateFor(fixture);
fixture.factory.dispose({ candidates: [disposedCandidate] });
assert.throws(
  () => fixture.factory.benchmark({ ...validOptions, candidate: disposedCandidate }),
  /fresh unretired candidate/
);
let policyCalls = 0;
const driftingCandidate = candidateFor(
  fixture,
  () => new AgentPolicy({
    maxEpisodes: policyCalls++ < 6 ? 2 : 1,
    maxToolCallsPerEpisode: 2
  })
);
assert.throws(
  () => fixture.factory.benchmark({
    ...validOptions,
    candidate: driftingCandidate,
    levels: [validLevel('drift-low', 1), validLevel('drift-high', 2)]
  }),
  /definition drifted/
);
Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => before
});
assert.throws(
  () => fixture.factory.benchmark(validOptions),
  /unmodified evidence ledger instance/
);
assert.equal(fixture.ledger.length, 1);
assert.equal(isTrustedHarnessFactoryBenchmarkReport(report), true);
assert.equal(fixture.ledger.serialize(), before);

const tampered = JSON.parse(before);
tampered.records[0].payload.factory.generation = 99;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|fingerprint|generation/
);
assert.throws(
  () => HarnessFactory.prototype.benchmark.call(Object.create(HarnessFactory.prototype), validOptions),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).benchmark(validOptions),
  /exact trusted factory/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_BOUNDARY_OK `
  + `malformedRejected=true duplicateRejected=true accessorRejected=true `
  + `untrustedCandidateRejected=true proxiedCandidateRejected=true retiredRejected=true `
  + `definitionDriftRejected=true mutableLedgerRejected=true tamperedRejected=true `
  + `forgedReportRejected=true proxiedReportRejected=true ledgerUnchanged=true `
  + `artifactFree=true authoritySuppressed=${report.authorityTransferred === false}`
);
