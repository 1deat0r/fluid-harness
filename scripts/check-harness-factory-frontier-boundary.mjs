import assert from 'node:assert/strict';

import {
  HARNESS_FACTORY_HOLDOUT_STATUSES,
  HarnessFactory,
  isTrustedHarnessFactoryFrontierPortfolioReport,
  isTrustedHarnessFactoryFrontierReport,
  isTrustedHarnessFactoryHistoryReport
} from '../src/harness-factory.mjs';
import { AgentPlannerCase } from '../src/agent-search.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const emptyFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-empty',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
assert.throws(
  () => emptyFixture.factory.frontier(),
  /at least one archived factory generation/
);
const emptyPortfolio = emptyFixture.factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(emptyPortfolio), true);
assert.equal(emptyPortfolio.consideredBenchmarkCount, 0);
assert.equal(emptyPortfolio.returnedBenchmarkCount, 0);
assert.equal(emptyPortfolio.truncated, false);
assert.deepEqual(emptyPortfolio.frontiers, []);
const emptyHistory = emptyFixture.factory.history();
assert.equal(isTrustedHarnessFactoryHistoryReport(emptyHistory), true);
assert.equal(emptyHistory.consideredGenerationCount, 0);
assert.equal(emptyHistory.returnedGenerationCount, 0);
assert.equal(emptyHistory.truncated, false);
assert.deepEqual(emptyHistory.generations, []);
assert.equal(emptyFixture.ledger.length, 0);

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const report = fixture.factory.manufacture({
  goal: 'create frontier history for boundary checks',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
assert.equal(report.status, 'ADOPTED');
assert.equal(report.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
assert.equal(isTrustedHarnessFactoryFrontierReport(report.frontier), true);
assert.equal(
  report.frontier.frontier[0].holdoutStatus,
  HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN
);

const forgedFrontier = Object.freeze({ ...report.frontier });
assert.equal(isTrustedHarnessFactoryFrontierReport(forgedFrontier), false);
const portfolio = fixture.factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(portfolio), true);
assert.equal(portfolio.consideredBenchmarkCount, 1);
assert.equal(portfolio.returnedBenchmarkCount, 1);
assert.equal(portfolio.frontiers[0].frontier[0].generation, 1);
const forgedPortfolio = Object.freeze({ ...portfolio });
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(forgedPortfolio), false);
const history = fixture.factory.history();
assert.equal(isTrustedHarnessFactoryHistoryReport(history), true);
assert.equal(history.consideredGenerationCount, 1);
assert.equal(history.generations[0].holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN);
const forgedHistory = Object.freeze({ ...history });
assert.equal(isTrustedHarnessFactoryHistoryReport(forgedHistory), false);
assert.throws(
  () => HarnessFactory.prototype.frontier.call(Object.create(HarnessFactory.prototype)),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).frontier(),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).history(),
  /exact trusted factory/
);

Object.defineProperty(fixture.ledger, 'serialize', {
  configurable: true,
  value: () => fixture.ledger.serialize()
});
assert.throws(
  () => fixture.factory.frontier(),
  /unmodified evidence ledger instance/
);

const noArchiveFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-no-archive',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const noArchive = noArchiveFixture.factory.manufacture({
  goal: 'do not create durable frontier evidence',
  plannerCandidates: [noArchiveFixture.plannerCandidate],
  cases: [noArchiveFixture.evaluationCase],
  ...noArchiveFixture.budgets,
  archive: false
});
assert.equal(noArchive.frontier.consideredGenerationCount, 0);
assert.equal(noArchive.frontier.frontierGenerationCount, 0);
assert.equal(noArchive.frontier.returnedGenerationCount, 0);
assert.equal(noArchive.frontier.truncated, false);
assert.equal(noArchiveFixture.ledger.length, 0);

const changedBenchmarkFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-benchmark',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const changedCase = new AgentPlannerCase({
  id: 'harness-factory-frontier-benchmark-changed-case',
  domain: 'graph',
  goal: 'graph',
  context: {
    taskId: 'harness-factory-frontier-benchmark-changed-task',
    description: 'Find a graph path'
  },
  task: {
    id: 'harness-factory-frontier-benchmark-changed-task',
    description: 'Find a graph path'
  },
  adversarial: true,
  expected: (report) => report?.completed === true
    && report.cycles[0].action.evidence === 'PROVEN'
    && report.cycles[0].action.result?.path?.join('>') === 'A>B'
});
changedBenchmarkFixture.factory.manufacture({
  goal: 'create first benchmark frontier generation',
  plannerCandidates: [changedBenchmarkFixture.plannerCandidate],
  cases: [changedBenchmarkFixture.evaluationCase],
  ...changedBenchmarkFixture.budgets
});
const changed = changedBenchmarkFixture.factory.manufacture({
  goal: 'create changed benchmark frontier generation',
  plannerCandidates: [changedBenchmarkFixture.plannerCandidate],
  cases: [changedCase],
  ...changedBenchmarkFixture.budgets
});
assert.equal(changed.status, 'ADOPTED');
assert.equal(changed.frontier.consideredGenerationCount, 1);
assert.equal(changed.frontier.frontierGenerationCount, 1);
assert.equal(changed.frontier.frontier[0].generation, 2);
assert.equal(changedBenchmarkFixture.ledger.verify(), true);
const changedPortfolio = changedBenchmarkFixture.factory.frontiers();
assert.equal(isTrustedHarnessFactoryFrontierPortfolioReport(changedPortfolio), true);
assert.equal(changedPortfolio.consideredBenchmarkCount, 2);
assert.equal(changedPortfolio.returnedBenchmarkCount, 2);
assert.equal(changedPortfolio.truncated, false);
assert.deepEqual(
  changedPortfolio.frontiers.map(({ frontier }) => frontier[0].generation),
  [1, 2]
);

const holdoutFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-frontier-holdout',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive'
});
const holdoutReport = holdoutFixture.factory.manufacture({
  goal: 'expose only a verified holdout frontier status',
  plannerCandidates: [holdoutFixture.plannerCandidate],
  cases: [holdoutFixture.evaluationCase],
  holdoutCases: [holdoutFixture.holdoutCase],
  ...holdoutFixture.budgets
});
assert.equal(holdoutReport.status, 'ADOPTED');
assert.equal(holdoutReport.holdoutStatus, HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED);
assert.equal(
  holdoutReport.frontier.frontier[0].holdoutStatus,
  HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
);
const tamperedHoldoutArchive = JSON.parse(holdoutFixture.ledger.serialize());
tamperedHoldoutArchive.records[0].payload.factory.holdout.passed = false;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tamperedHoldoutArchive)),
  /hash|fingerprint|holdout/
);

console.log(
  `FLUID_HARNESS_FACTORY_FRONTIER_BOUNDARY_OK `
  + `missingHistoryRejected=true forgedReportRejected=true forgedFactoryRejected=true `
  + `proxyRejected=true tamperedLedgerRejected=true noArchiveEmpty=true `
  + `benchmarkPartitioned=true portfolioPartitioned=true holdoutStatusBounded=true `
  + `tamperedHoldoutRejected=true `
  + `authoritySuppressed=${report.frontier.authorityTransferred === false}`
);
