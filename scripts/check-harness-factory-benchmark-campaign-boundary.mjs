import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function plannerFor(fixture, id) {
  return new AgentPlannerCandidate({
    id,
    description: `fresh planner ${id}`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
}

function candidateFor(
  fixture,
  id,
  plannerCandidate = plannerFor(fixture, `${id}-planner`),
  policyFactory = () => new AgentPolicy({
    maxEpisodes: 2,
    maxToolCallsPerEpisode: 2
  })
) {
  return new AgentArchitectureCandidate({
    id,
    description: `fresh campaign candidate ${id}`,
    plannerCandidate,
    policyFactory,
    components: { mode: 'bounded', candidate: id }
  });
}

function validLevel(id = 'campaign-boundary-level', computeUnits = 1) {
  return {
    id,
    computeUnits,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create archived evidence for benchmark campaign boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const firstCandidate = candidateFor(
  fixture,
  'harness-factory-benchmark-campaign-boundary-alpha'
);
const secondCandidate = candidateFor(
  fixture,
  'harness-factory-benchmark-campaign-boundary-beta'
);
const validOptions = {
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [validLevel()]
};
const report = fixture.factory.benchmarkCampaign(validOptions);
const before = fixture.ledger.serialize();

assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(report), true);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(Object.freeze({ ...report })), false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(new Proxy(report, {})), false);
assert.equal(Object.isFrozen(report), true);
assert.equal(Object.isFrozen(report.points), true);

assert.throws(
  () => fixture.factory.benchmarkCampaign({}),
  /at least two candidates|requires cases|requires levels/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({ ...validOptions, extra: true }),
  /only enumerable data properties/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'candidates', {
  enumerable: true,
  get: () => validOptions.candidates
});
assert.throws(
  () => fixture.factory.benchmarkCampaign(accessorOptions),
  /only enumerable data properties/
);

assert.throws(
  () => fixture.factory.benchmarkCampaign({ ...validOptions, candidates: [] }),
  /at least two candidates/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [firstCandidate]
  }),
  /at least two candidates/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: Array.from(
      { length: 9 },
      (_, index) => candidateFor(fixture, `too-many-campaign-${index}`)
    )
  }),
  /cannot exceed/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [
      candidateFor(fixture, 'duplicate-campaign-id'),
      candidateFor(fixture, 'duplicate-campaign-id')
    ]
  }),
  /ids, planners, and policy factories must be unique/
);
const sharedPlanner = plannerFor(fixture, 'shared-campaign-planner');
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [
      candidateFor(fixture, 'shared-planner-alpha', sharedPlanner),
      candidateFor(fixture, 'shared-planner-beta', sharedPlanner)
    ]
  }),
  /ids, planners, and policy factories must be unique/
);
const sharedPolicyFactory = () => new AgentPolicy({
  maxEpisodes: 2,
  maxToolCallsPerEpisode: 2
});
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [
      candidateFor(fixture, 'shared-policy-alpha', undefined, sharedPolicyFactory),
      candidateFor(fixture, 'shared-policy-beta', undefined, sharedPolicyFactory)
    ]
  }),
  /ids, planners, and policy factories must be unique/
);

for (const levels of [[], [validLevel(), validLevel('duplicate-level')], [validLevel('a', 1), validLevel('b', 1)]]) {
  assert.throws(
    () => fixture.factory.benchmarkCampaign({ ...validOptions, levels }),
    /requires levels|must be unique/
  );
}
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    levels: Array.from({ length: 9 }, (_, index) => validLevel(`too-many-levels-${index}`, index + 1))
  }),
  /cannot exceed/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
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
  () => fixture.factory.benchmarkCampaign({ ...validOptions, levels: [accessorLevel] }),
  /only enumerable data properties/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    levels: [{ ...validLevel(), productionBudget: { maxCases: 1 } }]
  }),
  /trusted EvaluationBudget/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    cases: [Object.create(Object.getPrototypeOf(fixture.evaluationCase))]
  }),
  /trusted planner cases/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    cases: [fixture.evaluationCase, fixture.evaluationCase]
  }),
  /case ids must be unique/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [Object.freeze({ ...firstCandidate }), secondCandidate]
  }),
  /trusted architecture candidates/
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [new Proxy(firstCandidate, {}), secondCandidate]
  }),
  /trusted architecture candidates/
);

const disposedCandidate = candidateFor(fixture, 'disposed-campaign-candidate');
fixture.factory.dispose({ candidates: [disposedCandidate] });
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [disposedCandidate, candidateFor(fixture, 'disposed-campaign-peer')]
  }),
  /fresh unretired candidates/
);

let policyCalls = 0;
const driftingCandidate = candidateFor(
  fixture,
  'drifting-campaign-candidate',
  undefined,
  () => new AgentPolicy({
    maxEpisodes: policyCalls++ < 3 ? 2 : 1,
    maxToolCallsPerEpisode: 2
  })
);
assert.throws(
  () => fixture.factory.benchmarkCampaign({
    ...validOptions,
    candidates: [candidateFor(fixture, 'stable-campaign-peer'), driftingCandidate],
    levels: [validLevel('drift-low', 1), validLevel('drift-high', 2)]
  }),
  /definition drifted/
);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => before
});
assert.throws(
  () => fixture.factory.benchmarkCampaign(validOptions),
  /unmodified evidence ledger instance/
);
assert.equal(fixture.ledger.length, 1);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignReport(report), true);
assert.equal(fixture.ledger.serialize(), before);

const tampered = JSON.parse(before);
tampered.records[0].payload.factory.generation = 99;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|fingerprint|generation/
);
assert.throws(
  () => HarnessFactory.prototype.benchmarkCampaign.call(
    Object.create(HarnessFactory.prototype),
    validOptions
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).benchmarkCampaign(validOptions),
  /exact trusted factory/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_BOUNDARY_OK `
  + `malformedRejected=true duplicateRejected=true accessorRejected=true `
  + `untrustedCandidateRejected=true proxiedCandidateRejected=true retiredRejected=true `
  + `definitionDriftRejected=true mutableLedgerRejected=true tamperedRejected=true `
  + `forgedReportRejected=true proxiedReportRejected=true ledgerUnchanged=true `
  + `artifactFree=${!Object.hasOwn(report, 'candidates') && !Object.hasOwn(report, 'primary')} `
  + `authoritySuppressed=${report.authorityTransferred === false}`
);
