import assert from 'node:assert/strict';

import { isTrustedHarnessFactoryReport } from '../src/harness-factory.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-improvement',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureFromFactoryArchive',
  includeFailingPlanner: true
});
const {
  factory,
  ledger,
  plannerCandidates,
  evaluationCase,
  budgets
} = fixture;

const first = factory.manufacture({
  goal: 'manufacture the first bounded factory generation',
  plannerCandidates,
  cases: [evaluationCase],
  ...budgets
});
assert.equal(isTrustedHarnessFactoryReport(first), true);
assert.equal(first.status, 'REJECTED');
assert.equal(first.improvedFromArchive, false);
assert.equal(first.generation, 1);
assert.equal(first.predecessor, null);
assert.equal(first.factoryMetadata.status, 'REJECTED');
assert.equal(first.factoryMetadata.benchmark.caseCount, 1);
assert.equal(first.archive.kind, 'architecture-discovery');
assert.equal(first.archive.sequence, 1);
assert.equal(ledger.length, 1);
assert.equal(first.proofStatus, 'NONE');

const second = factory.improve({
  goal: 'improve the next bounded factory generation from archived evidence',
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
assert.equal(second.improvedFromArchive, true);
assert.equal(second.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(second.researchContext.resultCount, 1);
assert.equal(second.researchContext.query.source, MEMORY_SOURCES.ARCHITECTURE_DISCOVERY);
assert.equal(second.reproducible, true);
assert.equal(second.proofStatus, 'PROVEN');
assert.equal(second.improvement.accepted, true);
assert.equal(second.improvement.benchmarkStable, true);
assert.equal(second.improvement.nonRegressing, true);
assert.equal(second.improvement.strictlyImproved, true);
assert.equal(second.improvement.baseline.archive.sequence, 1);
assert.equal(second.improvement.baseline.adopted, false);
assert.equal(second.improvement.current.adopted, true);
assert.equal(second.generation, 2);
assert.equal(second.predecessor.sequence, 1);
assert.equal(second.factoryMetadata.improvement.baselineSequence, 1);
assert.equal(second.factoryMetadata.status, 'ADOPTED');
assert.equal(second.improvement.deltas.productionSuccessRate, 1);
assert.equal(second.archive.kind, 'architecture-discovery');
assert.equal(second.archive.sequence, 2);
assert.equal(second.retiredCandidateCount, 1);
assert.equal(ledger.length, 2);
assert.equal(ledger.verify(), true);
const discoveries = ledger.restoreArchitectureDiscoveries();
assert.equal(discoveries.length, 2);
assert.equal(discoveries[0].factory.factoryId, fixture.factory.factoryId);
assert.equal(discoveries[0].factory.generation, 1);
assert.equal(discoveries[1].factory.generation, 2);
assert.equal(discoveries[1].factory.predecessor.sequence, 1);
assert.equal(
  discoveries[1].factory.benchmark.fingerprint,
  discoveries[0].factory.benchmark.fingerprint
);
assert.equal(discoveries[1].adopted, true);
assert.equal(discoveries[1].proposals[0].components.improvement, 'archive-informed');
assert.equal(discoveries[1].proposals[0].components.priorFactoryOutcome, 'rejected');
assert.equal(discoveries[1].proposals[0].components.priorFactoryResultCount, 1);
assert.equal(
  discoveries[0].proposals[0].plannerCandidateId,
  'harness-factory-improvement-failing-planner'
);
assert.equal(
  discoveries[1].proposals[0].plannerCandidateId,
  'harness-factory-improvement-registered-planner'
);
assert.equal(Object.hasOwn(second, 'memory'), false);
assert.equal(Object.hasOwn(second, 'historicalLedger'), false);
assert.equal(Object.hasOwn(second, 'discovery'), false);
assert.equal(Object.hasOwn(second, 'adoption'), false);
assert.equal(second.dataOnly, true);
assert.equal(second.authorityTransferred, false);

console.log(
  `FLUID_HARNESS_FACTORY_IMPROVEMENT_OK `
  + `first=${first.status} second=${second.status} `
  + `source=${second.researchContext.query.source} matches=${second.researchContext.resultCount} `
  + `priorOutcome=${discoveries[1].proposals[0].components.priorFactoryOutcome} `
  + `replay=${second.reproducible} proof=${second.proofStatus} `
  + `benchmarkStable=${second.improvement.benchmarkStable} `
  + `nonRegressing=${second.improvement.nonRegressing} strict=${second.improvement.strictlyImproved} `
  + `archives=${first.archive.sequence},${second.archive.sequence} `
  + `retired=${second.retiredCandidateCount}`
);
