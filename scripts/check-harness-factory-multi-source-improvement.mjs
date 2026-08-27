import assert from 'node:assert/strict';

import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureCandidate
} from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RECOMMENDATION_STATUSES,
  HARNESS_FACTORY_RESEARCH_TARGETS,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function reconstructedCandidate(fixture, recommendation, plannerCandidate) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'fresh holdout reconstruction',
    plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-multi-source-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includePartialPlanner: true,
  adoptionAuthority: new AgentArchitectureAdoptionAuthority({
    minimumProductionSuccessRate: 0.5,
    minimumProductionProvenRate: 0.5,
    minimumResearchSuccessRate: 0.5,
    minimumResearchProvenRate: 0.5,
    minimumSkepticSuccessRate: 0,
    minimumTransferSuccessRate: 0
  })
});
const cases = [fixture.evaluationCase, fixture.secondEvaluationCase];
const budgets = {
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
};

const first = fixture.factory.manufacture({
  goal: 'create a lower-performing adopted baseline',
  plannerCandidates: [fixture.partialPlannerCandidate, fixture.plannerCandidate],
  cases,
  ...budgets
});
assert.equal(first.status, 'ADOPTED');
assert.equal(first.generation, 1);

const recommendation = fixture.factory.recommend();
assert.equal(
  recommendation.status,
  HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
);
const plan = fixture.factory.researchPlan().plans.find(
  ({ target }) => target === HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT
);
assert.notEqual(plan, undefined);
const holdoutReceipt = fixture.factory.executeResearchPlanReceipt(plan, {
  candidate: reconstructedCandidate(
    fixture,
    recommendation,
    fixture.partialPlannerCandidate
  ),
  holdoutCases: [fixture.holdoutCase],
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(holdoutReceipt.resultStatus, 'PASSED');
assert.equal(holdoutReceipt.targetResolved, true);

const improved = fixture.factory.improve({
  goal: 'combine factory and receipt evidence before strict improvement',
  plannerCandidates: [fixture.plannerCandidate, fixture.partialPlannerCandidate],
  cases,
  ...budgets,
  memoryQuery: {
    sources: [
      MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION,
      MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
    ]
  }
});
assert.equal(isTrustedHarnessFactoryReport(improved), true);
assert.equal(improved.status, 'ADOPTED');
assert.equal(improved.generation, 2);
assert.equal(improved.improvedFromArchive, true);
assert.equal(improved.researchContext.query.source, null);
assert.deepEqual(
  improved.researchContext.query.sources,
  [MEMORY_SOURCES.ARCHITECTURE_DISCOVERY, MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION]
);
assert.equal(improved.researchContext.resultCount, 2);
assert.deepEqual(improved.researchContext.sourceCounts, {
  ARCHITECTURE_DISCOVERY: 1,
  HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION: 1
});
assert.equal(Object.isFrozen(improved.researchContext.sourceCounts), true);
assert.equal(Object.hasOwn(improved.researchContext, 'results'), false);
assert.equal(improved.researchContext.dataOnly, true);
assert.equal(improved.researchContext.historicalOnly, true);
assert.equal(improved.researchContext.authorityTransferred, false);
assert.equal(improved.improvement.strictlyImproved, true);
assert.equal(improved.improvement.nonRegressing, true);
assert.equal(improved.improvement.benchmarkStable, true);
assert.equal(improved.dataOnly, true);
assert.equal(improved.authorityTransferred, false);
assert.equal(Object.hasOwn(improved, 'candidate'), false);
assert.equal(Object.hasOwn(improved, 'runner'), false);
assert.equal(Object.hasOwn(improved, 'actionReport'), false);
assert.equal(fixture.ledger.verify(), true);

const discoveries = fixture.ledger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 2);
assert.equal(discoveries[1].proposals[0].components.priorFactoryResultCount, 2);
assert.equal(discoveries[1].proposals[0].components.priorHoldoutStatus, 'not-run');
assert.equal(discoveries[1].proposals[0].components.researchSource, 'STRUCTURED_MEMORY');

console.log(
  `FLUID_HARNESS_FACTORY_MULTI_SOURCE_IMPROVEMENT_OK sources=${improved.researchContext.query.sources.join(',')} `
  + `results=${improved.researchContext.resultCount} first=${first.status} second=${improved.status} `
  + `strict=${improved.improvement.strictlyImproved} fresh=true authorityTransferred=${improved.authorityTransferred}`
);
