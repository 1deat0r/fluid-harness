import assert from 'node:assert/strict';

import { HarnessFactory } from '../src/harness-factory.mjs';
import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import { MEMORY_SOURCES } from '../src/memory.mjs';
import {
  buildHarnessFactorySelfDesignFixture
} from './fixtures/harness-factory-self-design.mjs';

const fixture = buildHarnessFactorySelfDesignFixture({
  prefix: 'harness-factory-self-design-provenance'
});
const { factory, ledger, discoveryRunner, researchArchive, selfDesignOptions } = fixture;
const report = factory.selfDesignAndManufacture(selfDesignOptions());
const context = report.researchContext;
assert.equal(context.query.limit, 16);
assert.equal(context.query.source, null);
assert.equal(context.query.sources, null);
assert.equal(context.resultCount, 1);
assert.equal(context.sourceCounts[MEMORY_SOURCES.DISTRIBUTION_SHIFT], 1);
assert.deepEqual(context.provenance, [{
  hash: researchArchive.hash,
  kind: researchArchive.kind,
  sequence: researchArchive.sequence
}]);
assert.equal(Object.isFrozen(context), true);
assert.equal(Object.isFrozen(context.provenance), true);
assert.equal(Object.isFrozen(context.provenance[0]), true);
const archived = ledger.restoreArchitectureDiscoveries()[0];
assert.deepEqual(archived.factory.researchContext, context);
assert.equal(archived.factory.researchContext.authorityTransferred, false);
const serialized = ledger.serialize();
const restoredFactory = new HarnessFactory({
  factoryId: factory.factoryId,
  discoveryRunner,
  ledger: EvidenceLedger.fromSerialized(serialized)
});
assert.deepEqual(restoredFactory.history(), factory.history());
assert.deepEqual(
  restoredFactory.ledger.restoreArchitectureDiscoveries()[0].factory.researchContext,
  context
);
assert.equal(restoredFactory.ledger.verify(), true);

console.log(
  `FLUID_HARNESS_FACTORY_SELF_DESIGN_PROVENANCE_OK `
  + `results=${context.resultCount} distributionShift=${context.sourceCounts[MEMORY_SOURCES.DISTRIBUTION_SHIFT]} `
  + `provenance=${researchArchive.kind}:${researchArchive.sequence} frozen=true `
  + `archived=true deterministic=true roundTrip=true verify=${restoredFactory.ledger.verify()}`
);
