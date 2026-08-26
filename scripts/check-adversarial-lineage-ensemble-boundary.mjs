import assert from 'node:assert/strict';

import {
  AdversarialLineageEnsembleReport,
  AdversarialLineageEnsembleRunner,
  MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE,
  MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
} from '../src/adversarial-lineage-ensemble.mjs';
import {
  AdversarialLineageRunner,
  isTrustedAdversarialLineageRunner
} from '../src/adversarial-lineage.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';

function evaluationCase(id, adversarial = true) {
  return new EvaluationCase({
    id,
    domain: 'graph',
    adversarial,
    task: { id: `${id}-task`, description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === 'PROVEN'
  });
}

const validCases = [evaluationCase('adversarial-lineage-ensemble-boundary-case')];
const ordinaryCase = evaluationCase('adversarial-lineage-ensemble-boundary-ordinary', false);
const runner = new AdversarialLineageEnsembleRunner({
  ensembleId: 'adversarial-lineage-ensemble-boundary',
  maxLineages: 2
});

assert.throws(
  () => new AdversarialLineageEnsembleRunner({ unknown: true }),
  /only enumerable data properties/
);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({ maxLineages: MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE - 1 }),
  /between 2 and/
);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({ maxLineages: MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE + 1 }),
  /between 2 and/
);
const accessorOptions = {};
Object.defineProperty(accessorOptions, 'ensembleId', {
  enumerable: true,
  get() {
    return 'accessor-ensemble';
  }
});
assert.throws(
  () => new AdversarialLineageEnsembleRunner(accessorOptions),
  /only enumerable data properties/
);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({ lineageFactory: {} }),
  /lineageFactory must be a function/
);
assert.throws(
  () => runner.run({ candidateId: 'plain-case', cases: [{}] }),
  /trusted EvaluationCase/
);
assert.throws(
  () => runner.run({ candidateId: 'ordinary-case', cases: [ordinaryCase] }),
  /requires adversarial evaluation cases/
);
assert.throws(
  () => runner.run({ candidateId: 'small-ensemble', cases: validCases, lineageCount: 1 }),
  /lineageCount must be between/
);
assert.throws(
  () => runner.run({
    candidateId: 'large-ensemble',
    cases: validCases,
    lineageCount: MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE + 1
  }),
  /lineageCount must be between/
);
const forgedRunner = Object.create(AdversarialLineageRunner.prototype);
assert.equal(isTrustedAdversarialLineageRunner(forgedRunner), false);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({
    lineageFactory: () => forgedRunner
  }).run({ candidateId: 'forged-lineage', cases: validCases }),
  /trusted lineage runner/
);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({
    lineageFactory: () => ({})
  }).run({ candidateId: 'plain-lineage', cases: validCases }),
  /trusted lineage runner/
);
const sharedLineage = new AdversarialLineageRunner({
  lineageId: 'adversarial-lineage-ensemble-shared'
});
assert.throws(
  () => new AdversarialLineageEnsembleRunner({
    lineageFactory: () => sharedLineage
  }).run({ candidateId: 'reused-lineage', cases: validCases }),
  /lineage runner cannot be reused/
);
assert.throws(
  () => new AdversarialLineageEnsembleRunner({
    lineageFactory: () => new AdversarialLineageRunner({ lineageId: 'duplicate-lineage' })
  }).run({ candidateId: 'duplicate-lineage', cases: validCases }),
  /lineage ids must be unique/
);
const accessorRunOptions = {
  candidateId: 'accessor-run',
  cases: validCases
};
Object.defineProperty(accessorRunOptions, 'cases', {
  enumerable: true,
  get() {
    return validCases;
  }
});
assert.throws(
  () => runner.run(accessorRunOptions),
  /only enumerable data properties/
);
assert.throws(
  () => new AdversarialLineageEnsembleReport({
    ensembleId: 'forged-ensemble',
    candidateId: 'forged-candidate',
    lineages: [],
    token: {}
  }),
  /trusted runner path/
);

console.log(
  `FLUID_ADVERSARIAL_LINEAGE_ENSEMBLE_BOUNDARY_OK invalidConfigRejected=true `
  + `accessorRejected=true plainCaseRejected=true nonAdversarialRejected=true `
  + `capacityRejected=true forgedRunnerRejected=true plainRunnerRejected=true `
  + `runnerReuseRejected=true duplicateRejected=true forgedReportRejected=true`
);
