import assert from 'node:assert/strict';

import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-boundary',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureDirect'
});
const { factory, ledger, plannerCandidate } = fixture;
const beforeLedger = ledger.serialize();

const forgedFactory = Object.create(Object.getPrototypeOf(factory));
assert.throws(
  () => forgedFactory.proposeArchitectures({
    goal: 'forged factory',
    plannerCandidates: [plannerCandidate]
  }),
  /exact trusted factory/
);

const proxiedFactory = new Proxy(factory, {});
assert.throws(
  () => proxiedFactory.proposeArchitectures({
    goal: 'proxied factory',
    plannerCandidates: [plannerCandidate]
  }),
  /exact trusted factory/
);

const accessorOptions = {};
Object.defineProperty(accessorOptions, 'goal', {
  enumerable: true,
  get() {
    return 'accessor goal';
  }
});
accessorOptions.plannerCandidates = [plannerCandidate];
assert.throws(
  () => factory.proposeArchitectures(accessorOptions),
  /only enumerable data properties/
);

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'unsupported option',
    plannerCandidates: [plannerCandidate],
    unexpected: true
  }),
  /only enumerable data properties/
);

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'duplicate planner candidates',
    plannerCandidates: [plannerCandidate, plannerCandidate]
  }),
  /must be unique/
);

assert.throws(
  () => factory.proposeArchitectures({
    goal: 'forged planner candidate',
    plannerCandidates: [Object.create(Object.getPrototypeOf(plannerCandidate))]
  }),
  /trusted planner candidates/
);

const unknownFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-unknown',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureUnknown'
});
assert.throws(
  () => unknownFixture.factory.proposeArchitectures({
    goal: 'unknown planner reference',
    plannerCandidates: [unknownFixture.plannerCandidate]
  }),
  /unknown planner candidate/
);

const malformedFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-malformed',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureMalformed'
});
assert.throws(
  () => malformedFixture.factory.proposeArchitectures({
    goal: 'malformed policy',
    plannerCandidates: [malformedFixture.plannerCandidate]
  }),
  /safe integer/
);

const oversizedFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-oversized',
  includeResearch: false,
  proposalExportName: 'proposeArchitectureMany'
});
assert.throws(
  () => oversizedFixture.factory.proposeArchitectures({
    goal: 'too many proposals',
    plannerCandidates: [oversizedFixture.plannerCandidate]
  }),
  /maximum is 2/
);

const researchFixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-architecture-proposals-context',
  includeResearch: true,
  proposalExportName: 'proposeArchitectureFromResearch'
});
assert.throws(
  () => researchFixture.factory.proposeArchitectures({
    goal: 'forged research context',
    plannerCandidates: [researchFixture.plannerCandidate],
    researchContext: Object.create(
      Object.getPrototypeOf(researchFixture.researchContext)
    )
  }),
  /trusted structured memory context/
);

assert.deepEqual(ledger.serialize(), beforeLedger);
assert.equal(ledger.verify(), true);
assert.equal(unknownFixture.ledger.length, 0);
assert.equal(malformedFixture.ledger.length, 0);
assert.equal(oversizedFixture.ledger.length, 0);

console.log(
  `FLUID_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS_BOUNDARY_OK forgedRejected=true `
  + `proxiedRejected=true accessorRejected=true unknownPlannerRejected=true `
  + `malformedRejected=true oversizedRejected=true researchContextRejected=true `
  + `ledgerPreserved=${ledger.verify()}`
);
