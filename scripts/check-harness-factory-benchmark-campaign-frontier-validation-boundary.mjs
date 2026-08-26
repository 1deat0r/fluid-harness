import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryBenchmarkFrontierValidationReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCandidate(fixture, id, plannerCandidate, variant) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} architecture`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

function buildCampaign(factory, fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(fixture, `${prefix}-alpha`, fixture.plannerCandidate, 'alpha');
  const beta = buildCandidate(fixture, `${prefix}-beta`, alternatePlannerCandidate, 'beta');
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  const campaign = factory.archiveBenchmarkCampaign(
    factory.benchmarkCampaign({
      candidates: [alpha, beta],
      cases: [fixture.evaluationCase],
      levels: [level]
    })
  );
  return { alpha, beta, level, campaign, alternatePlannerCandidate };
}

function buildPoints(fixture, campaignData) {
  return [
    {
      candidate: buildCandidate(
        fixture,
        campaignData.alpha.id,
        fixture.plannerCandidate,
        'alpha'
      ),
      levelId: campaignData.level.id
    },
    {
      candidate: buildCandidate(
        fixture,
        campaignData.beta.id,
        campaignData.alternatePlannerCandidate,
        'beta'
      ),
      levelId: campaignData.level.id
    }
  ];
}

function buildBatch(fixture, prefix) {
  const campaignData = buildCampaign(fixture.factory, fixture, prefix);
  const batch = fixture.factory.validateBenchmarkCampaignFrontier({
    campaign: campaignData.campaign,
    points: buildPoints(fixture, campaignData),
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  });
  return { campaignData, batch };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-frontier-validation-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildCampaign(
  fixture.factory,
  fixture,
  'harness-factory-benchmark-campaign-frontier-validation-boundary-own'
);
const validPoints = () => buildPoints(fixture, own);
const validOptions = () => ({
  campaign: own.campaign,
  points: validPoints(),
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
const beforeValidation = fixture.ledger.serialize();

assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    campaign: Object.freeze({ ...own.campaign })
  }),
  /exact trusted factory|archived campaign/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    campaign: new Proxy(own.campaign, {})
  }),
  /exact trusted factory|archived campaign/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    campaign: fixture.factory.benchmarkCampaigns().campaigns[0]
  }),
  /exact trusted factory|archived campaign/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    points: validPoints().slice(0, 1)
  }),
  /cover every frontier point/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    points: [validPoints()[0], validPoints()[0]]
  }),
  /cover each frontier point once|frontier point/
);
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    points: [
      {
        candidate: buildCandidate(fixture, 'not-in-frontier', fixture.plannerCandidate, 'wrong'),
        levelId: own.level.id
      },
      validPoints()[1]
    ]
  }),
  /not in the archived frontier/
);
const accessorPoint = {
  candidate: validPoints()[0].candidate,
  levelId: own.level.id
};
Object.defineProperty(accessorPoint, 'levelId', {
  configurable: true,
  enumerable: true,
  get: () => own.level.id
});
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    points: [accessorPoint, validPoints()[1]]
  }),
  /only enumerable data properties/
);
const disposedCandidate = buildCandidate(
  fixture,
  own.alpha.id,
  fixture.plannerCandidate,
  'alpha'
);
fixture.factory.dispose({ candidates: [disposedCandidate], reason: 'frontier boundary check' });
assert.throws(
  () => fixture.factory.validateBenchmarkCampaignFrontier({
    ...validOptions(),
    points: [
      { candidate: disposedCandidate, levelId: own.level.id },
      validPoints()[1]
    ]
  }),
  /fresh unretired candidates/
);
assert.equal(fixture.ledger.serialize(), beforeValidation);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-frontier-validation-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreign = buildBatch(
  foreignFixture,
  'harness-factory-benchmark-campaign-frontier-validation-boundary-foreign'
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignFrontierValidations(foreign.batch),
  /exact validation from this factory/
);
assert.equal(fixture.ledger.serialize(), beforeValidation);

const mainBatch = fixture.factory.validateBenchmarkCampaignFrontier(validOptions());
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationReport(mainBatch), true);
const forgedBatch = Object.freeze({ ...mainBatch });
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationReport(forgedBatch), false);
assert.equal(isTrustedHarnessFactoryBenchmarkFrontierValidationReport(new Proxy(mainBatch, {})), false);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignFrontierValidations(forgedBatch),
  /exact validation from this factory/
);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignFrontierValidations(new Proxy(mainBatch, {})),
  /exact validation from this factory/
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-campaign-frontier-validation-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutable = buildBatch(
  mutableFixture,
  'harness-factory-benchmark-campaign-frontier-validation-boundary-mutable'
);
const mutableSerialized = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutableFixture.factory.archiveBenchmarkCampaignFrontierValidations(mutable.batch),
  /unmodified evidence ledger instance/
);

const serializedBeforeTamper = fixture.ledger.serialize();
const tampered = JSON.parse(serializedBeforeTamper);
tampered.records[0].payload.caseFingerprint = 'sha256:tampered';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize(), serializedBeforeTamper);

const archivedBatch = fixture.factory.archiveBenchmarkCampaignFrontierValidations(mainBatch);
assert.equal(archivedBatch.archived, true);
assert.equal(fixture.ledger.length, 3);
assert.throws(
  () => fixture.factory.archiveBenchmarkCampaignFrontierValidations(mainBatch),
  /already been archived/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FRONTIER_VALIDATION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true restoredRejected=true `
  + `coverageRejected=true duplicateRejected=true frontierRejected=true `
  + `accessorRejected=true disposedRejected=true foreignRejected=true `
  + `mutableRejected=true tamperedRejected=true repeatedRejected=true `
  + `ledgerUnchanged=true artifactFree=true authoritySuppressed=`
  + `${archivedBatch.authorityTransferred === false}`
);
