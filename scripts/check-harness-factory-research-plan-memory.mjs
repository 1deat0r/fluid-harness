import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import {
  HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES,
  HARNESS_FACTORY_RESEARCH_TARGETS
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
    description: 'candidate for research-plan memory checks',
    plannerCandidate: fixture.plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: recommendation.baseline.architecture.components
  });
}

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-plan-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromResearch'
});
fixture.factory.manufacture({
  goal: 'create a generation before plan-execution memory import',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const plan = fixture.factory.researchPlan().plans[0];
assert.equal(plan.target, HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT);
const receipt = fixture.factory.executeResearchPlanReceipt(plan, {
  candidate: reconstructedCandidate(fixture, fixture.factory.recommend()),
  holdoutCases: [fixture.holdoutCase],
  ...holdoutBudgets()
});
assert.equal(receipt.resultType, HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.VALIDATION);
assert.equal(receipt.resultStatus, 'PASSED');
assert.equal(receipt.targetResolved, true);
assert.equal(receipt.result.dataOnly, true);
assert.equal(receipt.result.authorityTransferred, false);

const verifiedLedger = EvidenceLedger.fromSerialized(fixture.ledger.serialize());
const memory = memoryFromLedger({
  ledger: verifiedLedger,
  maxEntries: 8,
  idPrefix: 'harness-factory-research-plan-memory'
});
const context = buildStructuredMemoryContext({
  memory,
  query: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION,
    keywords: ['harness-factory-research-plan-execution']
  }
});
assert.equal(memory.size, 2);
assert.equal(context.resultCount, 1);
assert.equal(context.query.source, MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION);
const entry = context.results[0];
assert.equal(entry.source, MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION);
assert.equal(entry.strategyKey, 'harness-factory-research-plan-execution');
assert.equal(entry.evidence, 'OBSERVED');
assert.equal(entry.historicalOnly, true);
assert.equal(entry.dataOnly, true);
assert.deepEqual(entry.provenance, receipt.archive);
assert.equal(entry.keywords.includes('target-validate_unseen_holdout'), true);
assert.equal(entry.keywords.includes('bridge-holdout_validation'), true);
assert.equal(entry.keywords.includes('result-validation'), true);
assert.equal(entry.keywords.includes('status-passed'), true);
assert.equal(entry.keywords.includes('resolved'), true);
assert.equal(entry.keywords.includes('archives-1'), true);
assert.equal(Object.hasOwn(entry, 'candidate'), false);
assert.equal(Object.hasOwn(entry, 'runner'), false);
assert.equal(Object.hasOwn(entry, 'actionReport'), false);

const proposal = fixture.proposalRunner.propose({
  goal: 'propose from research-plan execution memory',
  plannerCandidateIds: [fixture.plannerCandidate.id],
  researchContext: context
});
assert.equal(proposal.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(proposal.proposals[0].components.researchResultCount, 1);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_PLAN_MEMORY_OK `
  + `source=${context.query.source} results=${context.resultCount} `
  + `status=${receipt.resultStatus} targetResolved=${receipt.targetResolved} `
  + `provenanceSequence=${entry.provenance.sequence} `
  + `authorityTransferred=${receipt.authorityTransferred}`
);
