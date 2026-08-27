import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  isTrustedHarnessFactoryArchitectureProposalReport
} from '../src/harness-factory.mjs';
import {
  memoryFromLedger,
  MEMORY_SOURCES
} from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-archive-memory',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate } = fixture;

factory.proposeArchitectures({
  goal: 'archive a novel proposal for memory',
  plannerCandidates: [plannerCandidate],
  archive: true
});
factory.proposeArchitectures({
  goal: 'archive a repeated proposal for memory',
  plannerCandidates: [plannerCandidate],
  archive: true
});

const restoredLedger = EvidenceLedger.fromSerialized(ledger.serialize());
const memory = memoryFromLedger({
  ledger: restoredLedger,
  maxEntries: 8,
  idPrefix: 'proposal-memory'
});
const novel = memory.query({
  source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
  keywords: ['proposal-novel']
});
const repeated = memory.query({
  source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
  keywords: ['proposal-repeated']
});
const allProposals = memory.query({
  source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
  keywords: ['proposal-untested']
});

assert.equal(novel.returnedCount, 1);
assert.equal(repeated.returnedCount, 1);
assert.equal(allProposals.returnedCount, 2);
assert.deepEqual(allProposals.sourceCounts, {
  [MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL]: 2
});
assert.equal(novel.results[0].source, MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL);
assert.equal(novel.results[0].evidence, 'OBSERVED');
assert.equal(novel.results[0].provenance.kind, 'harness-factory-architecture-proposals');
assert.equal(novel.results[0].dataOnly, true);
assert.equal(novel.results[0].historicalOnly, true);
assert.equal(Object.hasOwn(novel.results[0], 'candidate'), false);
assert.equal(Object.hasOwn(novel.results[0], 'runner'), false);
assert.equal(Object.hasOwn(novel.results[0], 'actionReport'), false);

const beforeQuery = ledger.serialize();
const proposal = factory.proposeArchitectures({
  goal: 'use proposal history as bounded context',
  plannerCandidates: [plannerCandidate],
  memoryQuery: {
    source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
    keywords: ['proposal-repeated']
  }
});
assert.equal(isTrustedHarnessFactoryArchitectureProposalReport(proposal), true);
assert.equal(proposal.researchContext.source, 'STRUCTURED_MEMORY');
assert.equal(proposal.researchContext.resultCount, 1);
assert.equal(
  proposal.researchContext.query.source,
  MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL
);
assert.equal(proposal.proposals[0].historicalMatchCount, 2);
assert.equal(proposal.proposals[0].repeated, true);
assert.equal(ledger.serialize(), beforeQuery);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_MEMORY_OK novelMatches=${novel.returnedCount} `
  + `repeatedMatches=${repeated.returnedCount} allMatches=${allProposals.returnedCount} `
  + `freshContext=${proposal.researchContext.resultCount} historicalMatches=${proposal.proposals[0].historicalMatchCount} `
  + `source=${MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL} historicalOnly=${proposal.researchContext.historicalOnly} `
  + `authorityTransferred=${proposal.authorityTransferred}`
);
