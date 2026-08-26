import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryResearchPlanReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

function holdoutBudgets() {
  return {
    holdoutProductionBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutResearchBudget: new EvaluationBudget({ maxCases: 1 }),
    holdoutSkepticBudget: new EvaluationBudget({ maxCases: 1 })
  };
}

function reconstructedCandidate(fixture, recommendation) {
  return new AgentArchitectureCandidate({
    id: recommendation.baseline.architecture.architectureId,
    description: 'candidate for research-plan boundary checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create evidence for research-plan execution boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const planReport = fixture.factory.researchPlan();
const plan = planReport.plans[0];
const before = fixture.ledger.serialize();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(planReport), true);
assert.equal(Object.isFrozen(planReport), true);
assert.equal(Object.isFrozen(planReport.plans), true);
assert.equal(Object.isFrozen(plan), true);

const forgedPlan = Object.freeze({ ...plan });
const proxiedPlan = new Proxy(plan, {});
assert.throws(
  () => fixture.factory.executeResearchPlan(forgedPlan),
  /exact plan from this factory/
);
assert.throws(
  () => fixture.factory.executeResearchPlan(proxiedPlan),
  /exact plan from this factory/
);
assert.throws(
  () => HarnessFactory.prototype.executeResearchPlan.call(
    Object.create(HarnessFactory.prototype),
    plan
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).executeResearchPlan(plan),
  /exact trusted factory/
);

for (const options of [
  { candidate: null },
  { candidate: reconstructedCandidate(fixture, fixture.factory.recommend()), extra: true }
]) {
  assert.throws(
    () => fixture.factory.executeResearchPlan(plan, options),
    /only enumerable data properties|trusted candidate/
  );
}
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'candidate', {
  enumerable: true,
  get: () => reconstructedCandidate(fixture, fixture.factory.recommend())
});
assert.throws(
  () => fixture.factory.executeResearchPlan(plan, accessorOptions),
  /only enumerable data properties/
);

const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-execution-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
foreignFixture.factory.manufacture({
  goal: 'create a foreign research plan',
  plannerCandidates: [foreignFixture.plannerCandidate],
  cases: [foreignFixture.evaluationCase],
  ...foreignFixture.budgets
});
const foreignPlan = foreignFixture.factory.researchPlan().plans[0];
assert.throws(
  () => fixture.factory.executeResearchPlan(foreignPlan),
  /exact plan from this factory/
);

const recommendation = fixture.factory.recommend();
const archived = fixture.factory.executeResearchPlan(plan, {
  candidate: reconstructedCandidate(fixture, recommendation),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
assert.equal(archived.archived, true);
const afterArchive = fixture.ledger.serialize();
assert.notEqual(afterArchive, before);
assert.throws(
  () => fixture.factory.executeResearchPlan(plan, {
    candidate: reconstructedCandidate(fixture, recommendation),
    holdoutCases: [fixture.holdoutCase],
    ...holdoutBudgets()
  }),
  /stale/
);
assert.equal(fixture.ledger.serialize(), afterArchive);
assert.equal(Object.hasOwn(archived, 'candidate'), false);
assert.equal(Object.hasOwn(archived, 'runner'), false);
assert.equal(Object.hasOwn(archived, 'actionReport'), false);
assert.equal(archived.authorityTransferred, false);

const mutablePlan = Object.freeze({ ...fixture.factory.researchPlan().plans[0] });
assert.throws(
  () => fixture.factory.executeResearchPlan(mutablePlan),
  /exact plan from this factory/
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true foreignRejected=true `
  + `accessorRejected=true staleRejected=true ledgerUnchangedAfterStale=true `
  + `artifactFree=true authoritySuppressed=${archived.authorityTransferred === false}`
);
