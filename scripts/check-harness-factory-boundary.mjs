import assert from 'node:assert/strict';

import { AgentArchitectureCandidate } from '../src/agent-architecture.mjs';
import {
  HarnessFactory,
  isTrustedHarnessFactory,
  isTrustedHarnessFactoryDisposalReport,
  isTrustedHarnessFactoryReport
} from '../src/harness-factory.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { buildHarnessFactoryFixture } from './fixtures/harness-factory.mjs';

const fixture = buildHarnessFactoryFixture({
  prefix: 'harness-factory-boundary',
  includeResearch: true
});
const {
  factory,
  ledger,
  researchContext,
  plannerCandidate,
  evaluationCase,
  discoveryRunner,
  budgets
} = fixture;

assert.equal(isTrustedHarnessFactory(factory), true);
assert.throws(
  () => new HarnessFactory({
    discoveryRunner: Object.create(Object.getPrototypeOf(discoveryRunner)),
    ledger
  }),
  /trusted architecture discovery runner/
);
assert.throws(
  () => new HarnessFactory({
    discoveryRunner,
    ledger: Object.create(Object.getPrototypeOf(ledger))
  }),
  /trusted evidence ledger/
);
assert.throws(
  () => new HarnessFactory({
    discoveryRunner,
    ledger: new Proxy(ledger, {})
  }),
  /trusted evidence ledger/
);
const accessorFactoryOptions = {};
Object.defineProperty(accessorFactoryOptions, 'discoveryRunner', {
  enumerable: true,
  get() {
    return discoveryRunner;
  }
});
Object.defineProperty(accessorFactoryOptions, 'ledger', {
  enumerable: true,
  value: ledger
});
assert.throws(
  () => new HarnessFactory(accessorFactoryOptions),
  /only enumerable data properties/
);

const forgedResearchContext = Object.freeze(researchContext.toPlannerData());
assert.throws(
  () => factory.manufacture({
    goal: 'forged research context',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    researchContext: forgedResearchContext
  }),
  /trusted structured memory context/
);
const forgedPlannerCandidate = Object.freeze({ ...plannerCandidate });
assert.throws(
  () => factory.manufacture({
    goal: 'forged planner candidate',
    plannerCandidates: [forgedPlannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    researchContext: null
  }),
  /trusted/
);
const forgedCase = Object.freeze({ ...evaluationCase });
assert.throws(
  () => factory.manufacture({
    goal: 'forged case',
    plannerCandidates: [plannerCandidate],
    cases: [forgedCase],
    ...budgets,
    researchContext: null
  }),
  /trusted/
);
const accessorManufactureOptions = {};
Object.defineProperty(accessorManufactureOptions, 'goal', {
  enumerable: true,
  get() {
    return 'accessor goal';
  }
});
Object.defineProperty(accessorManufactureOptions, 'plannerCandidates', {
  enumerable: true,
  value: [plannerCandidate]
});
assert.throws(
  () => factory.manufacture(accessorManufactureOptions),
  /only enumerable data properties/
);
assert.throws(
  () => factory.manufacture({
    goal: 'malformed archive control',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    ...budgets,
    researchContext: null,
    archive: 'yes'
  }),
  /archive must be boolean/
);
assert.throws(
  () => factory.manufacture({
    goal: 'extra manufacture key',
    plannerCandidates: [plannerCandidate],
    cases: [evaluationCase],
    extra: true
  }),
  /only enumerable data properties/
);
assert.equal(ledger.length, 0);

const noArchive = factory.manufacture({
  goal: 'manufacture without archive',
  plannerCandidates: [plannerCandidate],
  cases: [evaluationCase],
  ...budgets,
  researchContext: null,
  archive: false
});
assert.equal(isTrustedHarnessFactoryReport(noArchive), true);
assert.equal(noArchive.status, 'ADOPTED');
assert.equal(noArchive.researchContext, null);
assert.equal(noArchive.archive, null);
assert.equal(noArchive.deployed, false);
assert.equal(noArchive.dataOnly, true);
assert.equal(noArchive.authorityTransferred, false);
assert.equal(ledger.length, 0);

const disposableCandidate = new AgentArchitectureCandidate({
  id: 'harness-factory-disposable-candidate',
  plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 1,
    maxToolCallsPerEpisode: 1
  }),
  components: { source: 'boundary-test' }
});
const disposal = factory.dispose({
  candidates: [disposableCandidate],
  reason: 'failed benchmark'
});
assert.equal(isTrustedHarnessFactoryDisposalReport(disposal), true);
assert.equal(disposal.status, 'DISPOSED');
assert.equal(disposal.count, 1);
assert.equal(factory.isDisposed(disposableCandidate), true);
assert.throws(
  () => factory.dispose({
    candidates: [disposableCandidate],
    reason: 'repeat disposal'
  }),
  /already been disposed/
);
assert.throws(
  () => factory.dispose({
    candidates: [Object.freeze({ ...disposableCandidate })],
    reason: 'forged candidate'
  }),
  /trusted architecture candidates/
);
const duplicateCandidate = new AgentArchitectureCandidate({
  id: disposableCandidate.id,
  plannerCandidate,
  policyFactory: () => new AgentPolicy({
    maxEpisodes: 1,
    maxToolCallsPerEpisode: 1
  }),
  components: { source: 'duplicate-test' }
});
assert.throws(
  () => factory.dispose({
    candidates: [disposableCandidate, duplicateCandidate],
    reason: 'duplicate ids'
  }),
  /candidate ids must be unique/
);
const accessorDisposeOptions = {};
Object.defineProperty(accessorDisposeOptions, 'candidates', {
  enumerable: true,
  get() {
    return [disposableCandidate];
  }
});
assert.throws(
  () => factory.dispose(accessorDisposeOptions),
  /only enumerable data properties/
);
assert.throws(
  () => factory.isDisposed(Object.freeze({ ...disposableCandidate })),
  /trusted candidate/
);

console.log(
  `FLUID_HARNESS_FACTORY_BOUNDARY_OK `
  + `forgedFactoryRejected=true forgedLedgerRejected=true proxyRejected=true `
  + `accessorFactoryRejected=true forgedResearchRejected=true forgedPlannerRejected=true `
  + `forgedCaseRejected=true accessorManufactureRejected=true archiveControlRejected=true `
  + `extraKeyRejected=true noArchive=true disposal=${disposal.status} `
  + `repeatDisposalRejected=true forgedDisposalRejected=true duplicateRejected=true `
  + `accessorDisposalRejected=true lookupBoundary=true authoritySuppressed=true`
);
