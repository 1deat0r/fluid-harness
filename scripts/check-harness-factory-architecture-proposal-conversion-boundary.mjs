import assert from 'node:assert/strict';

import {
  HarnessFactory,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES,
  isTrustedHarnessFactoryArchitectureProposalConversionReport
} from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-proposal-conversion-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate, evaluationCase, budgets } = fixture;

const emptyView = factory.architectureProposalConversion();
const forged = { ...emptyView, authorityTransferred: true };
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(forged),
  false
);
const prototype = Object.create(
  Object.getPrototypeOf(
    factory.architectureProposalConversion()
  )
);
assert.equal(
  isTrustedHarnessFactoryArchitectureProposalConversionReport(prototype),
  false
);

assert.throws(
  () => {
    const mutated = factory.architectureProposalConversion();
    mutated.consideredBatchCount = 99;
  },
  TypeError
);
assert.equal(
  Object.isFrozen(factory.architectureProposalConversion()),
  true
);
assert.equal(
  Object.isFrozen(
    Object.getPrototypeOf(
      factory.architectureProposalConversion()
    )
  ),
  true
);

const proxyFactory = new Proxy(factory, {});
assert.throws(
  () => proxyFactory.architectureProposalConversion(),
  /exact trusted factory/
);
const accessorFactory = Object.create(Object.getPrototypeOf(factory));
Object.defineProperty(accessorFactory, 'factoryId', {
  enumerable: true,
  get() {
    return factory.factoryId;
  }
});
assert.throws(
  () => factory.architectureProposalConversion.call(accessorFactory),
  /exact trusted factory/
);

const archived = factory.proposeArchitectures({
  goal: 'archive one batch before testing conversion boundaries',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(archived.archived, true);
const beforeLedger = ledger.serialize();
const beforeView = factory.architectureProposalConversion();
const afterView = factory.architectureProposalConversion();
assert.deepEqual(afterView, beforeView);
assert.deepEqual(ledger.serialize(), beforeLedger);

const tampered = JSON.parse(beforeLedger);
tampered.records[0].payload.proposalCount = 8;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash verification failed|counts are inconsistent|invalid shape/
);

const sibling = new HarnessFactory({
  factoryId: 'harness-factory-proposal-conversion-boundary-sibling',
  discoveryRunner: fixture.discoveryRunner,
  ledger
});
sibling.proposeArchitectures({
  goal: 'archive a sibling-factory batch that must stay out of scope',
  plannerCandidates: [plannerCandidate],
  archive: true
});
assert.equal(ledger.verify(), true);
const scopedView = factory.architectureProposalConversion();
assert.equal(scopedView.consideredBatchCount, 1);
assert.equal(scopedView.factoryId, factory.factoryId);
assert.deepEqual(scopedView.batches[0].archive, archived.archive);
const siblingView = sibling.architectureProposalConversion();
assert.equal(siblingView.consideredBatchCount, 1);
assert.equal(siblingView.factoryId, sibling.factoryId);
assert.notEqual(
  siblingView.batches[0].archive.hash,
  scopedView.batches[0].archive.hash
);

for (let index = 0; index < 9; index += 1) {
  factory.proposeArchitectures({
    goal: `overflow the conversion view with archived batch ${index + 1}`,
    plannerCandidates: [plannerCandidate],
    archive: true
  });
}
const overflow = factory.architectureProposalConversion();
assert.equal(overflow.consideredBatchCount, 10);
assert.equal(
  overflow.returnedBatchCount,
  MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES
);
assert.equal(overflow.truncated, true);
assert.equal(overflow.complete, false);
assert.equal(
  overflow.replayedBatchCount + overflow.convertedBatchCount + overflow.untestedBatchCount,
  overflow.consideredBatchCount
);
assert.equal(
  overflow.untestedFingerprintCount,
  overflow.archivedFingerprintCount - overflow.convertedFingerprintCount
);
assert.equal(
  overflow.batches.every(
    (batch, index) => index === 0
      || batch.archive.sequence > overflow.batches[index - 1].archive.sequence
  ),
  true
);
assert.equal(ledger.verify(), true);
assert.notEqual(ledger.serialize(), beforeLedger);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_BOUNDARY_OK `
  + `forged=${isTrustedHarnessFactoryArchitectureProposalConversionReport(forged)} `
  + `prototypeRejected=${isTrustedHarnessFactoryArchitectureProposalConversionReport(prototype)} `
  + `proxyRejected=true accessorRejected=true frozen=${Object.isFrozen(overflow)} `
  + `tamperedRejected=true siblingExcluded=${scopedView.consideredBatchCount === 1} `
  + `considered=${overflow.consideredBatchCount} returned=${overflow.returnedBatchCount} `
  + `truncated=${overflow.truncated} viewReadOnly=true `
  + `ledgerEntries=${ledger.length} verify=${ledger.verify()}`
);
