import assert from 'node:assert/strict';

import {
  HarnessFactory,
  isTrustedHarnessFactoryResearchPlanReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-boundary-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const emptyPlan = emptyFixture.factory.researchPlan();
const forgedEmptyPlan = Object.freeze({ ...emptyPlan });
const proxiedEmptyPlan = new Proxy(emptyPlan, {});
assert.equal(isTrustedHarnessFactoryResearchPlanReport(emptyPlan), true);
assert.equal(isTrustedHarnessFactoryResearchPlanReport(forgedEmptyPlan), false);
assert.equal(isTrustedHarnessFactoryResearchPlanReport(proxiedEmptyPlan), false);
assert.equal(emptyPlan.returnedPlanCount, 0);
assert.equal(emptyPlan.dataOnly, true);
assert.equal(emptyPlan.authorityTransferred, false);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create evidence for research plan boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const before = fixture.ledger.serialize();
const plan = fixture.factory.researchPlan();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(plan), true);
assert.equal(Object.isFrozen(plan), true);
assert.equal(Object.isFrozen(plan.plans), true);
assert.equal(Object.isFrozen(plan.plans[0]), true);
assert.equal(Object.isFrozen(plan.plans[0].requiredInputs), true);
assert.equal(Object.isFrozen(plan.plans[0].expectedEvidence), true);
assert.equal(Object.hasOwn(plan, 'agenda'), false);
assert.equal(Object.hasOwn(plan, 'factory'), false);
assert.equal(Object.hasOwn(plan.plans[0], 'candidate'), false);
assert.equal(Object.hasOwn(plan.plans[0], 'planner'), false);
assert.equal(Object.hasOwn(plan.plans[0], 'runner'), false);
assert.equal(Object.hasOwn(plan.plans[0], 'actionReport'), false);
assert.equal(Object.hasOwn(plan.plans[0], 'authority'), false);

for (const maxItems of [0, -1, 1.5, 9, null, '1']) {
  assert.throws(
    () => fixture.factory.researchPlan({ maxItems }),
    /maxItems/
  );
}
assert.throws(
  () => fixture.factory.researchPlan({ maxItems: 1, extra: true }),
  /only enumerable data properties/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'maxItems', {
  enumerable: true,
  get: () => 1
});
assert.throws(
  () => fixture.factory.researchPlan(accessorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => HarnessFactory.prototype.researchPlan.call(
    Object.create(HarnessFactory.prototype)
  ),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).researchPlan(),
  /exact trusted factory/
);
assert.equal(fixture.ledger.serialize(), before);

const agenda = fixture.factory.researchAgenda();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(agenda), false);
const foreignFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-boundary-foreign',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const foreignPlan = foreignFixture.factory.researchPlan();
assert.equal(isTrustedHarnessFactoryResearchPlanReport(foreignPlan), true);
assert.notEqual(foreignPlan.factoryId, plan.factoryId);
assert.equal(fixture.ledger.serialize(), before);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true malformedRejected=true `
  + `accessorRejected=true agendaRejected=true artifactFree=true `
  + `ledgerUnchanged=true authoritySuppressed=${plan.authorityTransferred === false}`
);
