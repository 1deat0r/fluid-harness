import assert from 'node:assert/strict';

import {
  isTrustedHarnessFactoryArchitectureProposalReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-research',
  includeResearch: true,
  proposalExportName: 'proposeArchitectureFromResearch'
});
const { factory, ledger, plannerCandidate, researchContext } = fixture;

const report = factory.proposeArchitectures({
  goal: 'propose an architecture informed by observed research',
  plannerCandidates: [plannerCandidate],
  researchContext
});

assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(report), true);
assert.equal(report.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(report.researchContext.resultCount, 1);
assert.equal(report.researchContext.sourceCounts.DISTRIBUTION_SHIFT, 1);
assert.equal(report.researchContext.dataOnly, true);
assert.equal(report.researchContext.historicalOnly, true);
assert.equal(report.researchContext.authorityTransferred, false);
assert.equal(Object.isFrozen(report.researchContext), true);
assert.equal(Object.isFrozen(report.researchContext.sourceCounts), true);
assert.equal(report.proposals.length, 1);
assert.equal(report.proposals[0].components.researchSource, 'STRUCTURED_MEMORY');
assert.equal(report.proposals[0].components.researchSignal, 'weakness-exposed');
assert.equal(report.proposals[0].components.researchResultCount, 1);
assert.equal(report.proposals[0].novel, true);
assert.equal(ledger.length, 0);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_RESEARCH_OK source=${report.researchContext.source} `
  + `results=${report.researchContext.resultCount} signal=${report.proposals[0].components.researchSignal} `
  + `novel=${report.proposals[0].novel} dataOnly=${report.dataOnly} `
  + `authorityTransferred=${report.authorityTransferred}`
);
