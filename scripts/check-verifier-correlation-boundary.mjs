import assert from 'node:assert/strict';

import { AdversarialLineageEnsembleRunner } from '../src/adversarial-lineage-ensemble.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import {
  auditVerifierCorrelation,
  VerifierCorrelationAuditReport,
  VERIFIER_CORRELATION_STATUSES
} from '../src/verifier-correlation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cases = [
  new EvaluationCase({
    id: 'verifier-correlation-boundary-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'verifier-correlation-boundary-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'verifier-correlation-boundary-unresolved',
    domain: 'graph',
    adversarial: true,
    task: {
      id: 'verifier-correlation-boundary-unresolved-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'C']],
      start: 'A',
      goal: 'B'
    },
    expected: (_report, error) => error instanceof TypeError
  })
];

const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'verifier-correlation-boundary',
  maxLineages: 2
}).run({
  candidateId: 'verifier-correlation-boundary-kernel',
  cases,
  lineageCount: 2
});
const audit = auditVerifierCorrelation(ensemble);

assert.equal(audit.correlatedCases, 1);
assert.equal(audit.diverseCases, 0);
assert.equal(audit.unresolvedCases, 1);
assert.equal(audit.coveredCases, 1);
assert.equal(audit.diversityComplete, false);
assert.equal(audit.requiresVerifierReview, true);
assert.equal(audit.cases[0].status, VERIFIER_CORRELATION_STATUSES.CORRELATED);
assert.equal(audit.cases[1].status, VERIFIER_CORRELATION_STATUSES.UNRESOLVED);
assert.equal(audit.cases[1].coveredLineages, 0);
assert.equal(audit.cases[1].distinctVerifierCount, 0);
assert.deepEqual(audit.cases[1].verifierIds, []);
assert.equal(audit.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(audit.productionEligible, false);
assert.equal(audit.authorityTransferred, false);
assert.equal(Object.hasOwn(audit, 'lineages'), false);
assert.equal(Object.hasOwn(audit, 'actionReport'), false);

assert.throws(
  () => auditVerifierCorrelation({}),
  /trusted adversarial lineage ensemble report/
);
assert.throws(
  () => auditVerifierCorrelation({ lineages: [] }),
  /trusted adversarial lineage ensemble report/
);

const accessorEnsemble = {};
Object.defineProperty(accessorEnsemble, 'lineages', {
  enumerable: true,
  get() {
    throw new Error('accessor should not be read');
  }
});
assert.throws(
  () => auditVerifierCorrelation(accessorEnsemble),
  /trusted adversarial lineage ensemble report/
);

const forgedEnsemble = Object.create(Object.getPrototypeOf(ensemble));
Object.assign(forgedEnsemble, ensemble);
assert.throws(
  () => auditVerifierCorrelation(forgedEnsemble),
  /trusted adversarial lineage ensemble report/
);

assert.throws(
  () => new VerifierCorrelationAuditReport({
    ensembleId: 'forged-audit',
    candidateId: 'forged-candidate',
    cases: []
  }),
  /trusted audit path/
);

console.log(
  `FLUID_VERIFIER_CORRELATION_BOUNDARY_OK correlated=${audit.correlatedCases} `
  + `unresolved=${audit.unresolvedCases} diverse=${audit.diverseCases} `
  + `incompletePreserved=${audit.diversityComplete === false} `
  + `accessorRejected=true forgedRejected=true constructorRejected=true `
  + `summaryOnly=${audit.dataOnly && audit.historicalOnly} `
  + `authoritySuppressed=${audit.authorityTransferred === false}`
);
