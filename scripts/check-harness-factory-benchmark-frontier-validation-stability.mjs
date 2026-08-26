import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES,
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport
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

function buildTwinCampaign(fixture, prefix) {
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
  return { alternatePlannerCandidate, alpha, beta, level, campaign };
}

function archiveTwinValidation(fixture, twin) {
  const validation = fixture.factory.validateBenchmarkCampaignFrontier({
    campaign: twin.campaign,
    points: [
      {
        candidate: buildCandidate(
          fixture,
          twin.alpha.id,
          fixture.plannerCandidate,
          'alpha'
        ),
        levelId: twin.level.id
      },
      {
        candidate: buildCandidate(
          fixture,
          twin.beta.id,
          twin.alternatePlannerCandidate,
          'beta'
        ),
        levelId: twin.level.id
      }
    ],
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  });
  return fixture.factory.archiveBenchmarkCampaignFrontierValidations(validation);
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-frontier-validation-stability',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const first = buildTwinCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-repeat'
);
const second = buildTwinCampaign(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-repeat'
);
archiveTwinValidation(fixture, first);
archiveTwinValidation(fixture, second);

const oneOffPlanner = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-stability-one-off-planner',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const oneOffCandidate = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-one-off',
  oneOffPlanner,
  'one-off'
);
const oneOffAlternatePlanner = new AgentPlannerCandidate({
  id: 'harness-factory-benchmark-frontier-validation-stability-one-off-alternate',
  plannerFactory: () => fixture.plannerCandidate.createPlanner()
});
const oneOffSecondCandidate = buildCandidate(
  fixture,
  'harness-factory-benchmark-frontier-validation-stability-one-off-second',
  oneOffAlternatePlanner,
  'one-off-second'
);
const oneOffLevel = {
  id: 'harness-factory-benchmark-frontier-validation-stability-one-off-budget',
  computeUnits: 1,
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
};
const oneOffCampaign = fixture.factory.archiveBenchmarkCampaign(
  fixture.factory.benchmarkCampaign({
    candidates: [oneOffCandidate, oneOffSecondCandidate],
    cases: [fixture.evaluationCase],
    levels: [oneOffLevel]
  })
);
fixture.factory.archiveBenchmarkCampaignValidation(
  fixture.factory.validateBenchmarkCampaign(oneOffCampaign, {
    candidate: buildCandidate(
      fixture,
      oneOffCandidate.id,
      oneOffPlanner,
      'one-off'
    ),
    levelId: oneOffLevel.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [fixture.holdoutCase]
  })
);

const beforeStability = fixture.ledger.serialize();
const stability = fixture.factory.benchmarkFrontierValidationStability();
assert.equal(
  isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(stability),
  true
);
assert.equal(Object.isFrozen(stability), true);
assert.equal(Object.isFrozen(stability.frontierScores), true);
assert.equal(stability.consideredCampaignCount, 3);
assert.equal(stability.returnedCampaignCount, 3);
assert.equal(stability.consideredValidationCount, 5);
assert.equal(stability.returnedValidationCount, 5);
assert.equal(stability.frontierGroupCount, 2);
assert.equal(stability.stableFrontierCount, 1);
assert.equal(stability.unstableFrontierCount, 0);
assert.equal(stability.insufficientFrontierCount, 1);
const stable = stability.frontierScores.find(
  ({ stabilityStatus }) => stabilityStatus
    === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
);
const insufficient = stability.frontierScores.find(
  ({ stabilityStatus }) => stabilityStatus
    === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
);
assert.notEqual(stable, undefined);
assert.notEqual(insufficient, undefined);
assert.equal(stable.campaignCount, 2);
assert.equal(stable.validationCount, 4);
assert.equal(stable.frontierCount, 2);
assert.equal(stable.passedCount, 2);
assert.equal(stable.failedCount, 0);
assert.equal(stable.incompleteCount, 0);
assert.equal(stable.passRate, 1);
assert.equal(stable.completeCount, 2);
assert.equal(stable.reproducibleCount, 2);
assert.equal(stable.independentCount, 2);
assert.equal(stable.stable, true);
assert.equal(stable.campaignStatuses.length, 2);
assert.equal(insufficient.campaignCount, 1);
assert.equal(insufficient.validationCount, 1);
assert.equal(insufficient.stable, false);
assert.equal(insufficient.campaignStatuses.length, 1);
assert.equal(stability.dataOnly, true);
assert.equal(stability.authorityTransferred, false);
assert.equal(Object.hasOwn(stable, 'candidate'), false);
assert.equal(Object.hasOwn(stable, 'campaign'), false);
assert.equal(Object.hasOwn(stable, 'runner'), false);
assert.equal(Object.hasOwn(stable.campaignStatuses[0], 'holdout'), false);
assert.equal(fixture.ledger.serialize(), beforeStability);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_OK `
  + `campaigns=${stability.consideredCampaignCount} groups=${stability.frontierGroupCount} `
  + `stable=${stability.stableFrontierCount} insufficient=${stability.insufficientFrontierCount} `
  + `stableCampaigns=${stable.campaignCount} stableValidations=${stable.validationCount} `
  + `ledgerUnchanged=${fixture.ledger.serialize() === beforeStability} `
  + `dataOnly=${stability.dataOnly} authorityTransferred=${stability.authorityTransferred}`
);
