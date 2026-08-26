import assert from 'node:assert/strict';

import { AgentArchitectureAdoptionAuthority } from '../src/agent-architecture.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { isTrustedHarnessFactoryHistoryReport } from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-holdout-recovery',
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
const recoveryHoldout = new AgentPlannerCase({
  id: 'harness-factory-holdout-recovery-second-holdout-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-holdout-recovery-second-holdout-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-holdout-recovery-second-holdout-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles?.[0]?.action?.evidence === 'PROVEN'
    && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>B'
});
const mainBudgets = {
  productionBudget: new EvaluationBudget({ maxCases: 2 }),
  researchBudget: new EvaluationBudget({ maxCases: 2 }),
  skepticBudget: new EvaluationBudget({ maxCases: 2 })
};
const holdoutBudgets = {
  holdoutProductionBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutResearchBudget: new EvaluationBudget({ maxCases: 2 }),
  holdoutSkepticBudget: new EvaluationBudget({ maxCases: 2 })
};
const mainCases = [fixture.evaluationCase, fixture.secondEvaluationCase];
const holdoutCases = [fixture.holdoutCase, recoveryHoldout];

assert.throws(
  () => fixture.factory.manufacture({
    goal: 'record a main-benchmark partial success and failed holdout',
    plannerCandidates: [fixture.partialPlannerCandidate],
    cases: mainCases,
    holdoutCases,
    ...mainBudgets,
    ...holdoutBudgets
  }),
  /holdout benchmark rejected/
);
assert.equal(fixture.ledger.length, 1);
assert.equal(fixture.ledger.verify(), true);
const failedArchive = fixture.ledger.restoreArchitectureDiscoveries()[0];
assert.equal(failedArchive.factory.status, 'REJECTED');
assert.equal(failedArchive.factory.holdout.passed, false);
assert.equal(failedArchive.factory.holdout.caseCount, 2);
assert.equal(failedArchive.factory.holdout.attemptedCases, 2);
assert.equal(failedArchive.factory.holdout.successes, 1);
assert.equal(failedArchive.factory.holdout.successRate, 0.5);
assert.equal(failedArchive.factory.holdout.provenRate, 1);

const recovered = fixture.factory.improve({
  goal: 'recover with a different planner after failed holdout evidence',
  plannerCandidates: [fixture.partialPlannerCandidate, fixture.plannerCandidate],
  cases: mainCases,
  holdoutCases,
  ...mainBudgets,
  ...holdoutBudgets,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['holdout-failed']
  }
});
assert.equal(recovered.status, 'ADOPTED');
assert.equal(recovered.improvedFromArchive, true);
assert.equal(recovered.improvement.accepted, true);
assert.equal(recovered.improvement.benchmarkStable, true);
assert.equal(recovered.improvement.nonRegressing, true);
assert.equal(recovered.improvement.strictlyImproved, true);
assert.equal(recovered.holdoutStatus, 'PASSED');
assert.equal(recovered.holdout.passed, true);
assert.equal(recovered.holdout.caseCount, 2);
assert.equal(recovered.holdout.attemptedCases, 2);
assert.equal(recovered.holdout.successes, 2);
assert.equal(recovered.holdout.proven, 2);
assert.equal(recovered.holdout.reproducible, true);
assert.equal(recovered.holdout.independent, true);
assert.deepEqual(recovered.frontier.statusCounts, {
  ADOPTED: 1,
  REJECTED: 1
});
assert.deepEqual(recovered.frontier.holdoutStatusCounts, {
  FAILED: 1,
  NOT_RUN: 0,
  PASSED: 1
});
assert.equal(recovered.frontier.recoveryCount, 1);
assert.equal(recovered.archive.sequence, 2);
assert.equal(fixture.ledger.length, 2);
assert.equal(fixture.ledger.verify(), true);
const restored = fixture.ledger.restoreArchitectureDiscoveries();
assert.equal(restored.length, 2);
assert.equal(restored[0].factory.status, 'REJECTED');
assert.equal(restored[0].factory.holdout.passed, false);
assert.equal(restored[1].factory.status, 'ADOPTED');
assert.equal(restored[1].candidates[0].plannerCandidateId, fixture.plannerCandidate.id);
assert.equal(restored[1].factory.holdout.passed, true);
assert.equal(restored[1].factory.improvement.accepted, true);
const frontier = fixture.factory.frontier();
assert.equal(frontier.frontierGenerationCount, 1);
assert.equal(frontier.frontier[0].generation, 2);
assert.equal(frontier.frontier[0].holdoutStatus, 'PASSED');
assert.equal(frontier.frontier[0].status, 'ADOPTED');
assert.equal(frontier.recoveryCount, 1);
const history = fixture.factory.history();
assert.equal(isTrustedHarnessFactoryHistoryReport(history), true);
assert.equal(history.consideredGenerationCount, 2);
assert.equal(history.returnedGenerationCount, 2);
assert.equal(history.truncated, false);
assert.deepEqual(
  history.generations.map(({ generation }) => generation),
  [1, 2]
);
assert.deepEqual(
  history.generations.map(({ status }) => status),
  ['REJECTED', 'ADOPTED']
);
assert.deepEqual(
  history.generations.map(({ holdoutStatus }) => holdoutStatus),
  ['FAILED', 'PASSED']
);
assert.equal(history.generations[1].improvement.accepted, true);
assert.equal(Object.hasOwn(history.generations[0], 'candidates'), false);
assert.equal(Object.hasOwn(history.generations[0], 'holdout'), false);
assert.equal(Object.isFrozen(history), true);
assert.equal(Object.isFrozen(history.generations), true);

console.log(
  `FLUID_HARNESS_FACTORY_HOLDOUT_RECOVERY_OK `
  + `failed=${failedArchive.factory.holdout.passed} recovered=${recovered.status} `
  + `planner=${restored[1].candidates[0].plannerCandidateId} `
  + `strict=${recovered.improvement.strictlyImproved} `
  + `holdout=${recovered.holdoutStatus} cases=${recovered.holdout.caseCount} `
  + `frontier=${frontier.frontier[0].generation} `
  + `history=${history.returnedGenerationCount}/${history.consideredGenerationCount} `
  + `authorityTransferred=${recovered.authorityTransferred}`
);
