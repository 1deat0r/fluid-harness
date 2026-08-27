import assert from 'node:assert/strict';

import { MEMORY_SOURCES } from '../src/memory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'factory-proposal-query-conflict',
  includeResearch: true,
  proposalExportName: 'proposeArchitectureFromResearch'
});
const { factory, ledger, plannerCandidate, researchContext } = fixture;
const beforeLedger = ledger.serialize();

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'ambiguous proposal research inputs',
    plannerCandidates: [plannerCandidate],
    researchContext,
    memoryQuery: {
      source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
    }
  }),
  /cannot use researchContext and memoryQuery together/
);

assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_ARCHIVE_QUERY_CONFLICT_OK `
  + `conflictRejected=true ledgerEntries=${ledger.length} ledgerPreserved=${ledger.verify()}`
);
