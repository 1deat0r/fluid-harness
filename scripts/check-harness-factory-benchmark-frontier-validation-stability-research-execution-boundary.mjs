import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport
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

function buildCampaign(fixture, prefix) {
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate`,
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
  return {
    alpha,
    beta,
    alternatePlannerCandidate,
    level,
    campaign: fixture.factory.archiveBenchmarkCampaign(
      fixture.factory.benchmarkCampaign({
        candidates: [alpha, beta],
        cases: [fixture.evaluationCase],
        levels: [level]
      })
    )
  };
}

function archivePoint(fixture, campaign, candidate, plannerCandidate, level) {
  return fixture.factory.archiveBenchmarkCampaignValidation(
    fixture.factory.validateBenchmarkCampaign(campaign, {
      candidate: buildCandidate(
        fixture,
        candidate.id,
        plannerCandidate,
        candidate.components.variant
      ),
      levelId: level.id,
      cases: [fixture.evaluationCase],
      holdoutCases: [fixture.holdoutCase]
    })
  );
}

function buildUnstableFixture(prefix) {
  const fixture = buildHarnessFactoryFixture({
    prefix,
    includeResearch: false,
    proposalExportName: 'proposeArchitectureDirect'
  });
  const first = buildCampaign(
    fixture,
    `${prefix}-repeat`
  );
  const second = buildCampaign(
    fixture,
    `${prefix}-repeat`
  );
  archivePoint(fixture, first.campaign, first.alpha, fixture.plannerCandidate, first.level);
  archivePoint(
    fixture,
    first.campaign,
    first.beta,
    first.alternatePlannerCandidate,
    first.level
  );
  archivePoint(fixture, second.campaign, second.alpha, fixture.plannerCandidate, second.level);
  const target = fixture.factory.researchAgenda().items.find(
    ({ target: itemTarget }) => itemTarget
      === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
  );
  assert.notEqual(target, undefined);
  return { fixture, first, second, target };
}

function validOptions(fixture, own) {
  return {
    campaign: own.second.campaign,
    points: [
      {
        candidate: buildCandidate(
          fixture,
          own.second.beta.id,
          own.second.alternatePlannerCandidate,
          'beta'
        ),
        levelId: own.second.level.id
      }
    ],
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  };
}

const own = buildUnstableFixture(
  'harness-factory-benchmark-frontier-validation-stability-research-execution-boundary'
);
const { fixture, first, second, target } = own;
const beforeRejections = fixture.ledger.serialize();

const forgedTarget = Object.freeze({ ...target });
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    forgedTarget,
    validOptions(fixture, own)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    new Proxy(target, {}),
    validOptions(fixture, own)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationResearch(
    target,
    validOptions(fixture, own)
  ),
  /not executable by the frontier bridge/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    { ...validOptions(fixture, own), archive: false }
  ),
  /requires archive true/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    { ...validOptions(fixture, own), points: [] }
  ),
  /requires variable points/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    {
      ...validOptions(fixture, own),
      points: [
        {
          candidate: buildCandidate(
            fixture,
            second.alpha.id,
            fixture.plannerCandidate,
            'alpha'
          ),
          levelId: second.level.id
        }
      ]
    }
  ),
  /match the target variable points/
);
const accessorOptions = validOptions(fixture, own);
Object.defineProperty(accessorOptions, 'points', {
  configurable: true,
  enumerable: true,
  get: () => validOptions(fixture, own).points
});
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    accessorOptions
  ),
  /only enumerable data properties/
);
const accessorPointOptions = validOptions(fixture, own);
Object.defineProperty(accessorPointOptions.points[0], 'levelId', {
  configurable: true,
  enumerable: true,
  get: () => second.level.id
});
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
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
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    proxiedCandidateOptions
  ),
  /trusted candidates/
);
const disposedCandidate = buildCandidate(
  fixture,
  second.beta.id,
  second.alternatePlannerCandidate,
  'beta'
);
fixture.factory.dispose({ candidates: [disposedCandidate] });
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    {
      ...validOptions(fixture, own),
      points: [{ candidate: disposedCandidate, levelId: second.level.id }]
    }
  ),
  /fresh unretired candidates/
);
assert.equal(fixture.ledger.serialize(), beforeRejections);

assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    { ...validOptions(fixture, own), campaign: first.campaign }
  ),
  /campaign does not match the target/
);
const restoredCampaign = fixture.factory.benchmarkCampaigns().campaigns.find(
  ({ archive }) => archive.sequence === second.campaign.archive.sequence
);
assert.notEqual(restoredCampaign, undefined);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    { ...validOptions(fixture, own), campaign: restoredCampaign }
  ),
  /exact archived campaign/
);
const foreign = buildUnstableFixture(
  'harness-factory-benchmark-frontier-validation-stability-research-execution-boundary-foreign'
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    foreign.target,
    validOptions(foreign.fixture, foreign)
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    { ...validOptions(fixture, own), campaign: foreign.second.campaign }
  ),
  /exact archived campaign/
);

const tampered = JSON.parse(beforeRejections);
tampered.records[0].payload.factoryId = 'tampered-factory';
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|inconsistent|fingerprint/
);
assert.equal(fixture.ledger.serialize(), beforeRejections);

const rechecked = fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
  target,
  validOptions(fixture, own)
);
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport(
    rechecked
  ),
  true
);
assert.equal(rechecked.frontierStatus, 'STABLE');
assert.equal(rechecked.targetResolved, true);
assert.deepEqual(rechecked.remainingVariablePoints, []);
assert.equal(fixture.ledger.length, 6);
assert.throws(
  () => fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    target,
    validOptions(fixture, own)
  ),
  /target is stale/
);

const mutable = buildUnstableFixture(
  'harness-factory-benchmark-frontier-validation-stability-research-execution-boundary-mutable'
);
const mutableSerialized = mutable.fixture.ledger.serialize();
Object.defineProperty(mutable.fixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutable.fixture.factory.executeBenchmarkFrontierValidationStabilityResearch(
    mutable.target,
    validOptions(mutable.fixture, mutable)
  ),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true wrongBridgeRejected=true `
  + `archiveBoundary=true pointsRejected=true accessorRejected=true `
  + `candidateRejected=true disposedRejected=true campaignMismatchRejected=true `
  + `restoredRejected=true foreignRejected=true tamperedRejected=true `
  + `staleRejected=true mutableRejected=true ledgerUnchanged=true `
  + `authoritySuppressed=${rechecked.authorityTransferred === false}`
);
