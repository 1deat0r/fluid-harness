import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryFrontierPortfolioReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-partition-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidates,
  plannerCandidate,
  evaluationCase,
  holdoutCase,
  budgets
} = fixture;

const first = factory.manufacture({
  goal: 'archive the first benchmark branch as a rejected baseline',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, 'REJECTED');
assert.equal(first.generation, 1);

const second = factory.manufacture({
  goal: 'archive a newer distinct benchmark partition',
  plannerCandidates: [plannerCandidate],
  cases: [holdoutCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, 'ADOPTED');
assert.equal(second.generation, 2);
assert.equal(second.predecessor.sequence, 1);
assert.notEqual(
  second.benchmarkIdentity.fingerprint,
  first.benchmarkIdentity.fingerprint
);

const branchImprovement = factory.improve({
  goal: 'improve the older benchmark branch explicitly',
  baselineGeneration: 1,
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
  }
});
assert.equal(isTrustedHarnessFactoryReport(branchImprovement), true);
assert.equal(branchImprovement.status, 'ADOPTED');
assert.equal(branchImprovement.generation, 3);
assert.equal(branchImprovement.predecessor.sequence, 2);
assert.equal(branchImprovement.improvement.accepted, true);
assert.equal(branchImprovement.improvement.baseline.archive.sequence, 1);
assert.equal(branchImprovement.improvement.baseline.adopted, false);
assert.equal(branchImprovement.factoryMetadata.improvement.baselineSequence, 1);
assert.equal(branchImprovement.factoryMetadata.benchmark.fingerprint, first.benchmarkIdentity.fingerprint);
assert.equal(
  branchImprovement.researchContext.query.taskId,
  `architecture-discovery:${first.archive.sequence}`
);
assert.equal(branchImprovement.frontier.consideredGenerationCount, 2);
assert.equal(branchImprovement.frontier.frontier[0].generation, 3);
assert.equal(Object.hasOwn(branchImprovement, 'discovery'), false);
assert.equal(Object.hasOwn(branchImprovement, 'adoption'), false);
assert.equal(branchImprovement.dataOnly, true);
assert.equal(branchImprovement.authorityTransferred, false);

const portfolio = factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(portfolio), true);
assert.equal(portfolio.consideredBenchmarkCount, 2);
assert.equal(portfolio.returnedBenchmarkCount, 2);
assert.equal(portfolio.truncated, false);
const originalBranch = portfolio.frontiers.find(
  ({ benchmarkIdentity }) => benchmarkIdentity.fingerprint === first.benchmarkIdentity.fingerprint
);
const newerPartition = portfolio.frontiers.find(
  ({ benchmarkIdentity }) => benchmarkIdentity.fingerprint === second.benchmarkIdentity.fingerprint
);
assert.notEqual(originalBranch, undefined);
assert.notEqual(newerPartition, undefined);
assert.deepEqual(originalBranch.frontier.map(({ generation }) => generation), [3]);
assert.deepEqual(newerPartition.frontier.map(({ generation }) => generation), [2]);
const history = factory.history();
assert.equal(history.consideredGenerationCount, 3);
assert.equal(history.returnedGenerationCount, 3);
assert.equal(history.generations[0].architecture.plannerCandidateId, fixture.failingPlannerCandidate.id);
assert.equal(history.generations[1].architecture.plannerCandidateId, plannerCandidate.id);
assert.equal(history.generations[2].architecture.plannerCandidateId, plannerCandidate.id);
assert.equal(history.generations[2].architecture.components.improvement, 'archive-informed');
assert.equal(typeof history.generations[2].architecture.architectureFingerprint, 'string');
assert.equal(Object.isFrozen(history.generations[0].architecture), true);
assert.equal(Object.isFrozen(history.generations[2].architecture.components), true);
assert.equal(Object.hasOwn(history.generations[0].architecture, 'plannerFactory'), false);
assert.equal(Object.hasOwn(history.generations[0].architecture, 'planner'), false);
assert.equal(Object.hasOwn(history.generations[0], 'candidates'), false);
const discoveries = ledger.restoreArchitectureDiscoveries();
assert.equal(
  discoveries[2].proposals[0].components.priorFactoryOutcome,
  'rejected'
);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_PARTITION_IMPROVEMENT_OK `
  + `baseline=1 selected=${branchImprovement.improvement.baseline.archive.sequence} `
  + `generation=${branchImprovement.generation} predecessor=${branchImprovement.predecessor.sequence} `
  + `partitions=${portfolio.returnedBenchmarkCount} originalFrontier=${originalBranch.frontier[0].generation} `
  + `newerFrontier=${newerPartition.frontier[0].generation} `
  + `historyArchitectures=${history.returnedGenerationCount} `
  + `strict=${branchImprovement.improvement.strictlyImproved} `
  + `dataOnly=${branchImprovement.dataOnly} authorityTransferred=${branchImprovement.authorityTransferred}`
);
