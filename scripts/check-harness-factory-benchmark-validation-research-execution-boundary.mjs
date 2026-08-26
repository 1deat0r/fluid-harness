import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { HarnessFactory } from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function buildCandidate(
  fixture,
  id,
  variant = id,
  plannerCandidate = fixture.plannerCandidate
) {
  return new AgentArchitectureCandidate({
    id,
    description: `${id} candidate`,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({ maxEpisodes: 2, maxToolCallsPerEpisode: 2 }),
    components: { variant }
  });
}

function buildFailedHoldout(prefix) {
  return new AgentPlannerCase({
    id: `${prefix}-failed-holdout`,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${prefix}-failed-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${prefix}-failed-task`,
      description: 'Find a graph path'
    },
    adversarial: true,
    expected: () => false
  });
}

function buildArchivedTarget(fixture, prefix) {
  const firstCandidate = buildCandidate(fixture, `${prefix}-alpha`, 'alpha');
  const alternatePlannerCandidate = new AgentPlannerCandidate({
    id: `${prefix}-alternate-planner`,
    plannerFactory: () => fixture.plannerCandidate.createPlanner()
  });
  const secondCandidate = buildCandidate(
    fixture,
    `${prefix}-beta`,
    'beta',
    alternatePlannerCandidate
  );
  const level = {
    id: `${prefix}-budget`,
    computeUnits: 1,
    productionBudget: new EvaluationBudget({ maxCases: 1 }),
    researchBudget: new EvaluationBudget({ maxCases: 1 }),
    skepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
  const campaign = fixture.factory.benchmarkCampaign({
    candidates: [firstCandidate, secondCandidate],
    cases: [fixture.evaluationCase],
    levels: [level]
  });
  const archivedCampaign = fixture.factory.archiveBenchmarkCampaign(campaign);
  const failedValidation = fixture.factory.validateBenchmarkCampaign(archivedCampaign, {
    candidate: buildCandidate(fixture, firstCandidate.id, 'alpha'),
    levelId: level.id,
    cases: [fixture.evaluationCase],
    holdoutCases: [buildFailedHoldout(prefix)]
  });
  const archivedValidation = fixture.factory.archiveBenchmarkCampaignValidation(
    failedValidation
  );
  const agenda = fixture.factory.researchAgenda();
  const target = agenda.items.find(
    ({ target: itemTarget }) => itemTarget === 'INVESTIGATE_BENCHMARK_VALIDATION'
  );
  assert.notEqual(target, undefined);
  return {
    archivedCampaign,
    firstCandidate,
    secondCandidate,
    level,
    target,
    archivedValidation
  };
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-execution-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const own = buildArchivedTarget(
  fixture,
  'harness-factory-benchmark-validation-research-execution-boundary-own'
);
const validOptions = () => ({
  campaign: own.archivedCampaign,
  candidate: buildCandidate(fixture, own.firstCandidate.id, 'alpha'),
  levelId: own.level.id,
  cases: [fixture.evaluationCase],
  holdoutCases: [fixture.holdoutCase]
});
const beforeRejections = fixture.ledger.serialize();

const forgedTarget = Object.freeze({ ...own.target });
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(forgedTarget, validOptions()),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(
    new Proxy(own.target, {}),
    validOptions()
  ),
  /exact agenda item/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, { archive: false }),
  /requires archive true/
);
assert.equal(fixture.ledger.serialize(), beforeRejections);

const secondCampaign = fixture.factory.benchmarkCampaign({
  candidates: [own.firstCandidate, own.secondCandidate],
  cases: [fixture.evaluationCase],
  levels: [own.level]
});
const archivedSecondCampaign = fixture.factory.archiveBenchmarkCampaign(secondCampaign);
const beforeSecondCampaignRejections = fixture.ledger.serialize();
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, {
    ...validOptions(),
    campaign: archivedSecondCampaign
  }),
  /campaign does not match the target/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, {
    ...validOptions(),
    candidate: buildCandidate(fixture, `${own.firstCandidate.id}-wrong`, 'wrong')
  }),
  /candidate or level does not match the target/
);
const restoredCampaign = fixture.factory.benchmarkCampaigns().campaigns[0];
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, {
    ...validOptions(),
    campaign: restoredCampaign
  }),
  /exact archived campaign/
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, {
    ...validOptions(),
    campaign: new Proxy(own.archivedCampaign, {})
  }),
  /exact archived campaign/
);
const accessorOptions = validOptions();
Object.defineProperty(accessorOptions, 'campaign', {
  configurable: true,
  enumerable: true,
  get: () => own.archivedCampaign
});
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, accessorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).executeBenchmarkValidationResearch(
    own.target,
    validOptions()
  ),
  /exact trusted factory/
);
assert.equal(fixture.ledger.serialize(), beforeSecondCampaignRejections);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-execution-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreign = buildArchivedTarget(
  foreignFixture,
  'harness-factory-benchmark-validation-research-execution-boundary-foreign'
);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(
    foreign.target,
    validOptions()
  ),
  /exact agenda item/
);
assert.equal(fixture.ledger.serialize(), beforeSecondCampaignRejections);

const regularFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-execution-boundary-regular',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
regularFixture.factory.manufacture({
  goal: 'create a non-benchmark-validation research target',
  plannerCandidates: [regularFixture.plannerCandidate],
  cases: [regularFixture.evaluationCase],
  ...regularFixture.budgets
});
const regularAgenda = regularFixture.factory.researchAgenda();
assert.equal(regularAgenda.items[0].target, 'VALIDATE_UNSEEN_HOLDOUT');
assert.throws(
  () => regularFixture.factory.executeBenchmarkValidationResearch(
    regularAgenda.items[0],
    {}
  ),
  /not executable/
);

const rechecked = fixture.factory.executeBenchmarkValidationResearch(
  own.target,
  validOptions()
);
assert.equal(rechecked.status, 'PASSED');
assert.equal(rechecked.archive.sequence, 4);
assert.throws(
  () => fixture.factory.executeBenchmarkValidationResearch(own.target, validOptions()),
  /target is stale/
);
assert.equal(fixture.ledger.length, 4);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-benchmark-validation-research-execution-boundary-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const mutable = buildArchivedTarget(
  mutableFixture,
  'harness-factory-benchmark-validation-research-execution-boundary-mutable'
);
const mutableSerialized = mutableFixture.ledger.serialize();
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableSerialized
});
assert.throws(
  () => mutableFixture.factory.executeBenchmarkValidationResearch(
    mutable.target,
    {
      campaign: mutable.archivedCampaign,
      candidate: buildCandidate(mutableFixture, mutable.firstCandidate.id, 'alpha'),
      levelId: mutable.level.id,
      cases: [mutableFixture.evaluationCase],
      holdoutCases: [mutableFixture.holdoutCase]
    }
  ),
  /unmodified evidence ledger instance/
);

console.log(
  `FLUID_HARNESS_FACTORY_BENCHMARK_VALIDATION_RESEARCH_EXECUTION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true archiveBoundary=true `
  + `campaignMismatchRejected=true candidateMismatchRejected=true `
  + `restoredRejected=true foreignRejected=true wrongTargetRejected=true `
  + `accessorRejected=true staleRejected=true mutableRejected=true `
  + `ledgerUnchanged=true authoritySuppressed=${rechecked.authorityTransferred === false}`
);
