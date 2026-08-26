import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport
} from '../src/harness-factory.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function makeCandidate(
  fixture,
  id,
  variant = 'alpha',
  plannerCandidate = fixture.plannerCandidate
) {
  return new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

function makeLevel(id, computeUnits) {
  return {
    id,
    computeUnits,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

function makeOptions(candidate, levelId, cases, holdoutCases) {
  return { candidate, levelId, cases, holdoutCases };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const alternatePlannerCandidate = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-campaign-validation-boundary-alternate-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const firstCandidate = makeCandidate(
  fixture,
  'harness-factory-benchmark-campaign-validation-boundary-alpha'
);
const secondCandidate = makeCandidate(
  fixture,
  'harness-factory-benchmark-campaign-validation-boundary-beta',
  'beta',
  alternatePlannerCandidate
);
const lowLevel = makeLevel('validation-boundary-low', 1);
const highLevel = makeLevel('validation-boundary-high', 2);
const campaign = fixture.factory.benchmarkCampaign({
  candidates: [firstCandidate, secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [lowLevel, highLevel]
});
const archived = fixture.factory.archiveBenchmarkCampaign(campaign);
const validOptions = makeOptions(
  makeCandidate(fixture, firstCandidate.id),
  lowLevel.id,
  [fixture.evaluationCase],
  [fixture.holdoutCase]
);
const before = fixture.ledger.serialize();

const forged = Object.freeze({ ...archived });
const proxied = new Proxy(archived, {});
const restored = fixture.factory.benchmarkCampaigns().campaigns[0];
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(forged), false);
assert.equal(isTrustedHarnessFactoryBenchmarkCampaignValidationReport(proxied), false);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(forged, validOptions),
  /archived campaign from this factory/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(proxied, validOptions),
  /archived campaign from this factory/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(restored, validOptions),
  /archived campaign from this factory/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(campaign, validOptions),
  /archived campaign from this factory/
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignCampaign = foreignFixture.factory.benchmarkCampaign({
  candidates: [
    makeCandidate(foreignFixture, 'foreign-alpha'),
    makeCandidate(
      foreignFixture,
      'foreign-beta',
      'beta',
      new AgentPlannerCandidate({
        id: 'foreign-alternate-planner',
        plannerFactory: () => foreignFixture.plannerCandidate.createPlanner()
      })
    )
  ],
  cases: [foreignFixture.evaluationCase],
  levels: [makeLevel('foreign-level', 1)]
});
const foreignArchived = foreignFixture.factory.archiveBenchmarkCampaign(foreignCampaign);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(foreignArchived, validOptions),
  /archived campaign from this factory/
);

assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    candidate: { ...validOptions.candidate }
  }),
  /trusted candidate/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    levelId: highLevel.id
  }),
  /frontier point/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    levelId: 'missing-level'
  }),
  /frontier point/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    candidate: makeCandidate(fixture, firstCandidate.id, 'drifted')
  }),
  /replay does not match/
);

const changedCase = new AgentPlannerCase({
  id: fixture.evaluationCase.id,
  domain: fixture.evaluationCase.domain,
  goal: fixture.evaluationCase.goal,
  context: {
    taskId: 'changed-case-task',
    description: 'Changed benchmark definition'
  },
  task: {
    id: 'changed-case-task',
    description: 'Changed benchmark definition'
  },
  adversarial: fixture.evaluationCase.adversarial,
  expected: fixture.evaluationCase.expected
});
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    cases: [changedCase]
  }),
  /do not match the archived campaign suite/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    holdoutCases: [fixture.evaluationCase]
  }),
  /must be disjoint/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    extra: true
  }),
  /only enumerable data properties/
);
const accessorOptions = { ...validOptions };
Object.defineProperty(accessorOptions, 'levelId', {
  configurable: true,
  enumerable: true,
  get: () => lowLevel.id
});
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, accessorOptions),
  /only enumerable data properties/
);

const disposedCandidate = makeCandidate(fixture, `${firstCandidate.id}-disposed`);
fixture.factory.dispose({ candidates: [disposedCandidate] });
assert.throws(
  () => fixture.factory.validateBenchmarkCampaign(archived, {
    ...validOptions,
    candidate: disposedCandidate
  }),
  /fresh unretired candidate/
);

const tamperedFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-validation-boundary-tampered',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const tamperedCampaign = tamperedFixture.factory.benchmarkCampaign({
  candidates: [
    makeCandidate(tamperedFixture, 'tampered-alpha'),
    makeCandidate(
      tamperedFixture,
      'tampered-beta',
      'beta',
      new AgentPlannerCandidate({
        id: 'tampered-alternate-planner',
        plannerFactory: () => tamperedFixture.plannerCandidate.createPlanner()
      })
    )
  ],
  cases: [tamperedFixture.evaluationCase],
  levels: [makeLevel('tampered-level', 1)]
});
const tamperedArchived = tamperedFixture.factory.archiveBenchmarkCampaign(tamperedCampaign);
const tamperedPayload = JSON.parse(tamperedFixture.ledger.serialize());
tamperedPayload.records[0].payload.points[0].productionSuccessRate = 0;
Object.defineProperty(tamperedFixture.ledger, 'serialize', {
  configurable: true,
  value: () => JSON.stringify(tamperedPayload)
});
assert.throws(
  () => tamperedFixture.factory.validateBenchmarkCampaign(
    tamperedArchived,
    makeOptions(
      makeCandidate(tamperedFixture, 'tampered-alpha'),
      'tampered-level',
      [tamperedFixture.evaluationCase],
      [tamperedFixture.holdoutCase]
    )
  ),
  /unmodified evidence ledger instance/
);

assert.throws(
  () => HarnessFactory.prototype.validateBenchmarkCampaign.call(
    Object.create(HarnessFactory.prototype),
    archived,
    validOptions
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).validateBenchmarkCampaign(archived, validOptions),
  /exact trusted factory/
);

assert.equal(fixture.ledger.serialize(), before);
assert.equal(archived.dataOnly, true);
assert.equal(archived.deployed, false);
assert.equal(archived.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true restoredRejected=true unarchivedRejected=true `
  + `foreignRejected=true plainCandidateRejected=true frontierRejected=true driftRejected=true `
  + `caseDriftRejected=true overlapRejected=true accessorRejected=true disposedRejected=true `
  + `tamperedRejected=true ledgerUnchanged=${fixture.ledger.serialize() === before} `
  + `authoritySuppressed=true`
);
