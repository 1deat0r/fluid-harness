import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryResearchPlanExecutionHistoryReport
} from '../src/harness-factory.mjs';
import {
  buildStructuredMemoryContext,
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
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
    description: 'candidate for research-plan memory boundary checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-memory-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create evidence for research-plan memory boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const plan = fixture.factory.researchPlan().plans[0];
const receipt = fixture.factory.executeResearchPlanReceipt(plan, {
  candidate: reconstructedCandidate(fixture, fixture.factory.recommend()),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
const before = fixture.ledger.serialize();
const memory = memoryFromLedger({
  ledger: fixture.ledger,
  maxEntries: 8,
  idPrefix: 'harness-factory-research-plan-memory-boundary'
});
assert.equal(memory.size, 2);
assert.throws(
  () => memoryFromLedger({
    ledger: fixture.ledger,
    maxEntries: 1,
    idPrefix: 'harness-factory-research-plan-memory-boundary'
  }),
  /exceeds remaining capacity/
);
assert.throws(
  () => memory.query({ source: 'UNSUPPORTED' }),
  /source is invalid/
);
const accessorQuery = {};
Object.defineProperty(accessorQuery, 'source', {
  enumerable: true,
  get: () => MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION
});
assert.throws(
  () => memory.query(accessorQuery),
  /only enumerable data properties/
);
const context = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION,
    keywords: ['target-validate_unseen_holdout']
  }
});
assert.equal(context.resultCount, 1);
assert.equal(context.results[0].provenance.sequence, receipt.archive.sequence);
assert.equal(Object.hasOwn(context.results[0], 'result'), false);
assert.equal(Object.hasOwn(context.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(context.results[0], 'runner'), false);
assert.equal(Object.hasOwn(context.results[0], 'actionReport'), false);
assert.equal(context.results[0].authorityTransferred, undefined);
assert.equal(fixture.ledger.serialize(), before);
const executionHistory = fixture.factory.researchPlanExecutions();
assert.equal(isTrustedHarnessFactoryResearchPlanExecutionHistoryReport(executionHistory), true);
assert.equal(executionHistory.dataOnly, true);
assert.equal(executionHistory.authorityTransferred, false);

assert.throws(
  () => HarnessFactory.prototype.researchPlanExecutions.call(
    Object.create(HarnessFactory.prototype)
  ),
  /exact trusted factory/
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_MEMORY_BOUNDARY_OK `
  + `capacityRejected=true unsupportedSourceRejected=true accessorRejected=true `
  + `artifactFree=true ledgerUnchanged=true historyTrusted=true `
  + `authoritySuppressed=${executionHistory.authorityTransferred === false}`
);
