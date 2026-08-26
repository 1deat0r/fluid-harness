import assert from 'node:assert/strict';

import {
  AdversarialLineageRunner,
  AdversarialLineageReport,
  isTrustedAdversarialLineageReport,
  MAX_ADVERSARIAL_LINEAGE_CASES
} from '../src/adversarial-lineage.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  PromotionAuthority
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

function adversarialCase(id = 'adversarial-lineage-boundary-case') {
  return new EvaluationCase({
    id,
    domain: 'graph',
    adversarial: true,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.completed === undefined
      ? report?.evidence === 'PROVEN'
      : false
  });
}

const ordinaryCase = new EvaluationCase({
  id: 'adversarial-lineage-boundary-ordinary',
  domain: 'graph',
  task: { id: 'adversarial-lineage-boundary-ordinary-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: () => true
});

const validCase = adversarialCase();
const makeRunner = () => new EvaluationRunner({ harness: new FluidHarness() });
const firstReport = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-boundary-valid',
  runnerFactory: makeRunner
}).run({
  candidateId: 'boundary-kernel',
  cases: [validCase]
});
assert.throws(
  () => new AdversarialLineageReport({
    lineageId: 'forged-report',
    candidateId: 'forged-candidate',
    summary: {
      results: [],
      eligibleCases: 0,
      attemptedCases: 0,
      skippedCases: 0,
      successes: 0,
      proofEligibleCases: 0,
      proven: 0,
      adversarialCases: 0,
      adversarialSuccesses: 0,
      weaknessesExposed: 0,
      complete: true
    }
  }),
  /trusted runner path/
);
assert.equal(isTrustedAdversarialLineageReport(firstReport), true);
assert.equal(firstReport.productionEligible, false);
assert.equal(firstReport.authorityTransferred, false);
assert.throws(
  () => new PromotionAuthority().decide(firstReport),
  /report produced by EvaluationRunner/
);

assert.throws(
  () => new AdversarialLineageRunner({ unknown: true }),
  /only enumerable data properties/
);
const accessorConstructorOptions = {};
Object.defineProperty(accessorConstructorOptions, 'lineageId', {
  enumerable: true,
  get() {
    return 'accessor-lineage';
  }
});
assert.throws(
  () => new AdversarialLineageRunner(accessorConstructorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => new AdversarialLineageRunner({ runnerFactory: {} }),
  /runnerFactory must be a function/
);
assert.throws(
  () => new AdversarialLineageRunner({ runnerFactory: () => ({}) }).run({
    candidateId: 'forged-runner',
    cases: [validCase]
  }),
  /must return a trusted EvaluationRunner/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'plain-case',
    cases: [{}]
  }),
  /trusted EvaluationCase/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'no-adversarial',
    cases: [ordinaryCase]
  }),
  /requires adversarial evaluation cases/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'duplicate-case-ids',
    cases: [validCase, validCase]
  }),
  /case ids must be unique/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'too-many-cases',
    cases: new Array(MAX_ADVERSARIAL_LINEAGE_CASES + 1).fill(validCase)
  }),
  /cannot contain more than/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'forged-budget',
    cases: [validCase],
    budget: { maxCases: 1 }
  }),
  /trusted EvaluationBudget/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'oversized-budget',
    cases: [validCase],
    budget: new EvaluationBudget({ maxCases: MAX_ADVERSARIAL_LINEAGE_CASES + 1 })
  }),
  /budget cannot exceed/
);
const accessorRunOptions = {
  candidateId: 'accessor-options',
  cases: [validCase]
};
Object.defineProperty(accessorRunOptions, 'cases', {
  enumerable: true,
  get() {
    return [validCase];
  }
});
assert.throws(
  () => new AdversarialLineageRunner().run(accessorRunOptions),
  /only enumerable data properties/
);
assert.throws(
  () => new AdversarialLineageRunner().run({
    candidateId: 'unknown-option',
    cases: [validCase],
    unknown: true
  }),
  /only enumerable data properties/
);
const accessorExecutionOptions = {
  candidateId: 'accessor-execution-options',
  cases: [validCase],
  executionOptions: {}
};
Object.defineProperty(accessorExecutionOptions.executionOptions, 'value', {
  enumerable: true,
  get() {
    return true;
  }
});
assert.throws(
  () => new AdversarialLineageRunner().run(accessorExecutionOptions),
  /only enumerable data properties/
);

const reusableRunner = makeRunner();
const reusableLineage = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-reuse',
  runnerFactory: () => reusableRunner
});
reusableLineage.run({ candidateId: 'reuse-kernel', cases: [adversarialCase('reuse-one')] });
assert.throws(
  () => reusableLineage.run({ candidateId: 'reuse-kernel', cases: [adversarialCase('reuse-two')] }),
  /evaluation runner cannot be reused/
);

const sharedHarness = new FluidHarness();
const sharedHarnessLineage = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-shared-harness',
  runnerFactory: () => new EvaluationRunner({ harness: sharedHarness })
});
sharedHarnessLineage.run({
  candidateId: 'shared-harness-kernel',
  cases: [adversarialCase('shared-one')]
});
assert.throws(
  () => sharedHarnessLineage.run({
    candidateId: 'shared-harness-kernel',
    cases: [adversarialCase('shared-two')]
  }),
  /evaluation harness cannot be reused/
);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_BOUNDARY_OK forgedRunnerRejected=true `
  + `plainCaseRejected=true nonAdversarialRejected=true duplicateRejected=true `
  + `capacityRejected=true forgedBudgetRejected=true accessorRejected=true `
  + `runnerReuseRejected=true harnessReuseRejected=true promotionRejected=true `
  + `summaryOnly=${firstReport.dataOnly && firstReport.historicalOnly} `
  + `productionEligible=${firstReport.productionEligible} authorityTransferred=${firstReport.authorityTransferred}`
);
