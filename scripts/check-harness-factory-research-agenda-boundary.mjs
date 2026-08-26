import assert from 'node:assert/strict';

import { EvidenceLedger } from '../src/evidence-ledger.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactoryResearchAgendaReport
} from '../src/harness-factory.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
fixture.factory.manufacture({
  goal: 'create verified evidence for agenda boundaries',
  plannerCandidates: [fixture.plannerCandidate],
  cases: [fixture.evaluationCase],
  ...fixture.budgets
});
const agenda = fixture.factory.researchAgenda();
const serializedBefore = fixture.ledger.serialize();
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(agenda), true);
assert.equal(Object.isFrozen(agenda), true);
assert.equal(Object.isFrozen(agenda.items), true);
assert.equal(Object.isFrozen(agenda.items[0]), true);
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(Object.freeze({ ...agenda })), false);
assert.equal(isTrustedHarnessFactoryResearchAgendaReport(new Proxy(agenda, {})), false);
assert.equal(agenda.items[0].dataOnly, true);
assert.equal(agenda.items[0].authorityTransferred, false);
assert.equal(Object.hasOwn(agenda.items[0], 'candidate'), false);
assert.equal(Object.hasOwn(agenda.items[0], 'planner'), false);
assert.equal(Object.hasOwn(agenda.items[0], 'runner'), false);
assert.equal(Object.hasOwn(agenda.items[0], 'actionReport'), false);

for (const maxItems of [0, -1, 1.5, 9, null, '1']) {
  assert.throws(
    () => fixture.factory.researchAgenda({ maxItems }),
    /maxItems/
  );
}
assert.throws(
  () => fixture.factory.researchAgenda({ maxItems: 1, extra: true }),
  /only enumerable data properties/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'maxItems', {
  enumerable: true,
  get: () => 1
});
assert.throws(
  () => fixture.factory.researchAgenda(accessorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => HarnessFactory.prototype.researchAgenda.call(Object.create(HarnessFactory.prototype)),
  /exact trusted factory/
);
assert.throws(
  () => new Proxy(fixture.factory, {}).researchAgenda(),
  /exact trusted factory/
);
assert.equal(fixture.ledger.serialize(), serializedBefore);

const mutableFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-research-agenda-mutable',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
mutableFixture.factory.manufacture({
  goal: 'reject mutable ledger inspection',
  plannerCandidates: [mutableFixture.plannerCandidate],
  cases: [mutableFixture.evaluationCase],
  ...mutableFixture.budgets
});
Object.defineProperty(mutableFixture.ledger, 'serialize', {
  configurable: true,
  value: () => mutableFixture.ledger.serialize()
});
assert.throws(
  () => mutableFixture.factory.researchAgenda(),
  /unmodified evidence ledger instance/
);
assert.equal(mutableFixture.ledger.length, 1);

const tampered = JSON.parse(serializedBefore);
tampered.records[0].payload.factory.generation = 99;
assert.throws(
  () => EvidenceLedger.fromSerialized(JSON.stringify(tampered)),
  /hash|fingerprint|generation/
);

console.log(
  `FLUID_HARNESS_FACTORY_RESEARCH_AGENDA_BOUNDARY_OK `
  + `forgedRejected=true proxiedRejected=true malformedRejected=true `
  + `accessorRejected=true spoofedFactoryRejected=true mutableLedgerRejected=true `
  + `tamperedRejected=true ledgerUnchanged=true artifactFree=true `
  + `authoritySuppressed=${agenda.authorityTransferred === false}`
);
