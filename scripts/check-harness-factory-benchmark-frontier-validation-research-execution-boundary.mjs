import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport,
  HARNESS_FACTORY_RESEARCH_TARGETS
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

function buildOwnCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const alpha = buildCandidate(
    fixture,
    `${prefix}-alpha`,
    fixture.plannerCandidate,
    'alpha'
  );
  const beta = buildCandidate(
    fixture,
    `${prefix}-beta`,
    alternatePlannerCandidate,
    'beta'
  );
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  const campaign = fixture.factory.archiveBenchmarkCampaign(
    fixture.factory.benchmarkCampaign({
      candidates: [alpha, beta],
      cases: [fixture.evaluationCase],
      levels: [level]
    })
  );
  fixture.factory.archiveBenchmarkCampaignValidation(
    fixture.factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(fixture, alpha.id, fixture.plannerCandidate, 'alpha'),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases: [fixture.holdoutCase]
    })
  );
  const agenda = fixture.factory.researchAgenda();
  const target = agenda.items.find(
    ({ target: itemTarget }) => itemTarget
      === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
  );
  assert.notEqual(target, undefined);
  return { alpha, beta, alternatePlannerCandidate, level, campaign, target };
}

function validOptions(fixture, own) {
  return {
    campaign: own.campaign,
    points: [
      {
        candidate: buildCandidate(
          fixture,
          own.beta.id,
          own.alternatePlannerCandidate,
          'beta'
        ),
        levelId: own.level.id
      }
    ],
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-execution-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildOwnCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-research-execution-boundary-own'
);
const beforeRejections = fixture.ledger.serialize();

const forgedTarget = Object.freeze({ ...own.target });
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    forgedTarget,
    validOptions(fixture, own)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    new Proxy(own.target, {}),
    validOptions(fixture, own)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), archive: false }
  ),
  /requires archive true/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), points: [] }
  ),
  /requires missing points/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    {
      ...validOptions(fixture, own),
      points: [
        {
          candidate: buildCandidate(
            fixture,
            own.alpha.id,
            fixture.plannerCandidate,
            'alpha'
          ),
          levelId: own.level.id
        }
      ]
    }
  ),
  /match the target missing points/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    {
      ...validOptions(fixture, own),
      points: [
        validOptions(fixture, own).points[0],
        validOptions(fixture, own).points[0]
      ]
    }
  ),
  /exactly the target missing points/
);
const accessorOptions = validOptions(fixture, own);
Object.defineProperty(accessorOptions, 'points', {
  configurable: true,
  enumerable: true,
  get: () => validOptions(fixture, own).points
});
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    accessorOptions
  ),
  /only enumerable data properties/
);
const accessorPointOptions = validOptions(fixture, own);
Object.defineProperty(accessorPointOptions.points[0], 'levelId', {
  configurable: true,
  enumerable: true,
  get: () => own.level.id
});
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    accessorPointOptions
  ),
  /only enumerable data properties/
);
const proxiedCandidateOptions = validOptions(fixture, own);
proxiedCandidateOptions.points[0].candidate = new Proxy(
  proxiedCandidateOptions.points[0].candidate,
  {}
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    proxiedCandidateOptions
  ),
  /trusted candidates/
);
const disposedCandidate = buildCandidate(
  fixture,
  own.beta.id,
  own.alternatePlannerCandidate,
  'beta'
);
fixture.factory.dispose({ candidates: [disposedCandidate] });
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    {
      ...validOptions(fixture, own),
      points: [{ candidate: disposedCandidate, levelId: own.level.id }]
    }
  ),
  /fresh unretired candidates/
);
assert.equal(fixture.ledger.serialize(), beforeRejections);

const secondCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [own.alpha, own.beta],
    cases: [fixture.evaluationCase],
    levels: [own.level]
  })
);
const beforeCampaignRejections = fixture.ledger.serialize();
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), campaign: secondCampaign }
  ),
  /campaign does not match the target/
);
const restoredCampaign = fixture.factory.benchmarkCampaigns().campaigns.find(
  ({ archive }) => archive.sequence === own.campaign.archive.sequence
);
assert.notEqual(restoredCampaign, undefined);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), campaign: restoredCampaign }
  ),
  /exact archived campaign/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), campaign: new Proxy(own.campaign, {}) }
  ),
  /exact archived campaign/
);
assert.equal(fixture.ledger.serialize(), beforeCampaignRejections);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-execution-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreign = buildOwnCampaign(
  foreignFixture,
  'harness-factory-benchmark-frontier-validation-research-execution-boundary-foreign'
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    foreign.target,
    validOptions(foreignFixture, foreign)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    { ...validOptions(fixture, own), campaign: foreign.campaign }
  ),
  /exact archived campaign/
);

const regularFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-execution-boundary-regular',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
regularFixture.factory.manufacture({
  goal: 'create a non-frontier-validation research target',
  plannerCandidates: [regularFixture.plannerCandidate],
  cases: [regularFixture.evaluationCase],
  ...regularFixture.budgets
});
const regularTarget = regularFixture.factory.researchAgenda().items[0];
assert.equal(regularTarget.target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
assert.throws(
  () => regularFixture.factory.executeBenchmarkFrontierValidationResearch(
    regularTarget,
    {}
  ),
  /not executable by the frontier bridge/
);

const targetScore = fixture.factory.benchmarkFrontierValidationScorecard().batchScores.find(
  ({ campaignArchive }) => campaignArchive.sequence === own.campaign.archive.sequence
);
assert.notEqual(targetScore, undefined);
const forgedScore = Object.freeze({ ...targetScore });
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(forgedScore),
  false
);
const tampered = JSON.parse(beforeCampaignRejections);
tampered.records[0].payload.factoryId = 'tampered-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize(), beforeCampaignRejections);

const rechecked = fixture.factory.executeBenchmarkFrontierValidationResearch(
  own.target,
  validOptions(fixture, own)
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(rechecked),
  true
);
assert.equal(rechecked.frontierStatus, 'PASSED');
assert.equal(rechecked.targetResolved, true);
assert.equal(fixture.ledger.length, 4);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    own.target,
    validOptions(fixture, own)
  ),
  /target is stale/
);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-research-execution-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutableOwn = buildOwnCampaign(
  mutableFixture,
  'harness-factory-benchmark-frontier-validation-research-execution-boundary-mutable-own'
);
const mutableSerialized = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutableFixture.factory.executeBenchmarkFrontierValidationResearch(
    mutableOwn.target,
    validOptions(mutableFixture, mutableOwn)
  ),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true archiveBoundary=true `
  + `coverageRejected=true duplicateRejected=true accessorRejected=true `
  + `candidateRejected=true disposedRejected=true campaignMismatchRejected=true `
  + `restoredRejected=true foreignRejected=true wrongTargetRejected=true `
  + `tamperedRejected=true staleRejected=true mutableRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=${rechecked.authorityTransferred === false}`
);
