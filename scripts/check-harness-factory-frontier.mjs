import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryFrontierPortfolioReport,
  isTrustedHarnessFactoryFrontierReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidate,
  plannerCandidates,
  evaluationCase,
  budgets
} = fixture;

const first = factory.manufacture({
  goal: 'create a rejected frontier generation',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, 'REJECTED');
assert.equal(first.frontier.consideredGenerationCount, 1);
assert.equal(first.frontier.frontierGenerationCount, 1);
assert.equal(first.frontier.frontier.length, 1);
assert.equal(first.frontier.frontier[0].generation, 1);
assert.equal(first.frontier.frontier[0].status, 'REJECTED');

const second = factory.improve({
  goal: 'create an adopted frontier generation',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets,
  memoryQuery: {
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords: ['rejected']
  }
});
assert.equal(isTrustedHarnessFactoryReport(second), true);
assert.equal(second.status, 'ADOPTED');
assert.equal(second.frontier.consideredGenerationCount, 2);
assert.equal(second.frontier.frontierGenerationCount, 1);
assert.equal(second.frontier.returnedGenerationCount, 1);
assert.equal(second.frontier.truncated, false);
assert.equal(second.frontier.frontier[0].generation, 2);
assert.equal(second.frontier.frontier[0].status, 'ADOPTED');
assert.equal(second.frontier.frontier[0].archive.sequence, 2);
assert.equal(second.frontier.dataOnly, true);
assert.equal(second.frontier.authorityTransferred, false);

const third = factory.manufacture({
  goal: 'retain an equally fit verified frontier generation',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets
});
assert.equal(third.status, 'ADOPTED');
assert.equal(third.generation, 3);
assert.equal(third.frontier.consideredGenerationCount, 3);
assert.equal(third.frontier.frontierGenerationCount, 2);
assert.equal(third.frontier.returnedGenerationCount, 2);
assert.deepEqual(
  third.frontier.frontier.map(({ generation }) => generation),
  [2, 3]
);
assert.equal(third.frontier.frontier[0].archive.sequence, 2);
assert.equal(third.frontier.frontier[1].archive.sequence, 3);
assert.equal(third.frontier.frontier[0].fitness.productionSuccessRate, 1);
assert.equal(third.frontier.frontier[1].fitness.productionSuccessRate, 1);

for (let index = 0; index < 8; index += 1) {
  const repeated = factory.manufacture({
    goal: `retain bounded frontier generation ${index + 4}`,
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets
  });
  assert.equal(repeated.status, 'ADOPTED');
}

const restoredFrontier = factory.frontier();
assert.equal(isTrustedHarnessFactoryFrontierReport(restoredFrontier), true);
assert.equal(restoredFrontier.factoryId, factory.factoryId);
assert.equal(restoredFrontier.benchmarkIdentity.fingerprint, third.benchmarkIdentity.fingerprint);
assert.equal(restoredFrontier.consideredGenerationCount, 11);
assert.equal(restoredFrontier.frontierGenerationCount, 10);
assert.equal(restoredFrontier.returnedGenerationCount, 8);
assert.equal(restoredFrontier.maxEntries, 8);
assert.equal(restoredFrontier.truncated, true);
assert.deepEqual(
  restoredFrontier.frontier.map(({ generation }) => generation),
  [4, 5, 6, 7, 8, 9, 10, 11]
);
assert.equal(Object.isFrozen(restoredFrontier), true);
assert.equal(Object.isFrozen(restoredFrontier.frontier), true);
assert.equal(Object.isFrozen(restoredFrontier.frontier[0]), true);
assert.equal(ledger.verify(), true);

const portfolio = factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(portfolio), true);
assert.equal(portfolio.factoryId, factory.factoryId);
assert.equal(portfolio.consideredBenchmarkCount, 1);
assert.equal(portfolio.returnedBenchmarkCount, 1);
assert.equal(portfolio.maxPartitions, 8);
assert.equal(portfolio.truncated, false);
assert.equal(portfolio.frontiers.length, 1);
assert.equal(
  portfolio.frontiers[0].benchmarkIdentity.fingerprint,
  restoredFrontier.benchmarkIdentity.fingerprint
);
assert.deepEqual(
  portfolio.frontiers[0].frontier.map(({ generation }) => generation),
  restoredFrontier.frontier.map(({ generation }) => generation)
);
assert.equal(Object.isFrozen(portfolio), true);
assert.equal(Object.isFrozen(portfolio.frontiers), true);

const partitionCapFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-partition-cap',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
for (let index = 0; index < 9; index += 1) {
  const partitionCase = index === 0
    ? partitionCapFixture.evaluationCase
    : new AgentPlannerCase({
      id: `harness-factory-frontier-partition-cap-case-${index}`,
      domain: 'graph',
      goal: 'graph',
      context: {
        taskId: `harness-factory-frontier-partition-cap-task-${index}`,
        description: 'Find a graph path'
      },
      task: {
        id: `harness-factory-frontier-partition-cap-task-${index}`,
        description: 'Find a graph path'
      },
      adversarial: true,
      expected: (report) => report?.completed === true
        && report.cycles?.[0]?.action?.evidence === 'PROVEN'
        && report.cycles?.[0]?.action?.result?.path?.join('>') === 'A>B'
    });
  partitionCapFixture.factory.manufacture({
    goal: `create benchmark partition ${index + 1}`,
    plannerCandidates: [partitionCapFixture.plannerCandidate],
    cases: [partitionCase],
    ...partitionCapFixture.budgets
  });
}
partitionCapFixture.factory.manufacture({
  goal: 'revisit an earlier benchmark partition',
  plannerCandidates: [partitionCapFixture.plannerCandidate],
  cases: [partitionCapFixture.evaluationCase],
  ...partitionCapFixture.budgets
});
const cappedPortfolio = partitionCapFixture.factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(cappedPortfolio), true);
assert.equal(cappedPortfolio.consideredBenchmarkCount, 9);
assert.equal(cappedPortfolio.returnedBenchmarkCount, 8);
assert.equal(cappedPortfolio.maxPartitions, 8);
assert.equal(cappedPortfolio.truncated, true);
assert.deepEqual(
  cappedPortfolio.frontiers.map(({ frontier }) => frontier[frontier.length - 1].generation),
  [3, 4, 5, 6, 7, 8, 9, 10]
);
assert.equal(Object.isFrozen(cappedPortfolio), true);
assert.equal(Object.isFrozen(cappedPortfolio.frontiers), true);

console.log(
  `FLUID_HARNESS_FACTORY_FRONTIER_OK `
  + `generations=${restoredFrontier.consideredGenerationCount} `
  + `frontier=${restoredFrontier.frontier.map(({ generation }) => generation).join(',')} `
  + `dominated=1 benchmark=${restoredFrontier.benchmarkIdentity.fingerprint} `
  + `bounded=${restoredFrontier.returnedGenerationCount}/${restoredFrontier.maxEntries} `
  + `partitions=${portfolio.returnedBenchmarkCount}/${portfolio.maxPartitions} `
  + `capPartitions=${cappedPortfolio.returnedBenchmarkCount}/${cappedPortfolio.consideredBenchmarkCount} `
  + `capTruncated=${cappedPortfolio.truncated} `
  + `dataOnly=${restoredFrontier.dataOnly} authorityTransferred=${restoredFrontier.authorityTransferred}`
);
