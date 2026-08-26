import assert from 'node:assert/strict';

import {
  AdversarialLineageEnsembleRunner,
  isTrustedAdversarialLineageEnsembleReport
} from '../src/adversarial-lineage-ensemble.mjs';
import {
  auditVerifierCorrelation,
  VERIFIER_CORRELATION_STATUSES,
  isTrustedVerifierCorrelationAudit
} from '../src/verifier-correlation.mjs';
import { EvaluationCase } from '../src/evaluation.mjs';
import { EVIDENCE_LEVELS } from '../src/evidence.mjs';

const cases = [
  new EvaluationCase({
    id: 'verifier-correlation-success',
    domain: 'graph',
    adversarial: true,
    task: { id: 'verifier-correlation-success-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (report) => report?.evidence === EVIDENCE_LEVELS.PROVEN
  }),
  new EvaluationCase({
    id: 'verifier-correlation-weakness',
    domain: 'graph',
    adversarial: true,
    task: { id: 'verifier-correlation-weakness-task', description: 'Find a graph path' },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: () => false
  })
];

const ensemble = new AdversarialLineageEnsembleRunner({
  ensembleId: 'verifier-correlation-positive',
  maxLineages: 3
}).run({
  candidateId: 'verifier-correlation-kernel',
  cases,
  lineageCount: 3
});

assert.equal(isTrustedAdversarialLineageEnsembleReport(ensemble), true);
const audit = auditVerifierCorrelation(ensemble);

assert.equal(isTrustedVerifierCorrelationAudit(audit), true);
assert.equal(audit.auditType, 'verifier-correlation');
assert.equal(audit.ensembleId, ensemble.ensembleId);
assert.equal(audit.candidateId, ensemble.candidateId);
assert.equal(audit.lineageCount, 3);
assert.equal(audit.caseCount, 2);
assert.equal(audit.correlatedCases, 2);
assert.equal(audit.diverseCases, 0);
assert.equal(audit.unresolvedCases, 0);
assert.equal(audit.coveredCases, 2);
assert.equal(audit.correlationRate, 1);
assert.equal(audit.diversityComplete, false);
assert.equal(audit.runtimeIndependent, true);
assert.equal(audit.requiresVerifierReview, true);
assert.equal(audit.evidence, EVIDENCE_LEVELS.OBSERVED);
assert.equal(audit.dataOnly, true);
assert.equal(audit.historicalOnly, true);
assert.equal(audit.productionEligible, false);
assert.equal(audit.authorityTransferred, false);
assert.equal(Object.isFrozen(audit), true);
assert.equal(Object.isFrozen(audit.cases), true);
assert.equal(Object.isFrozen(audit.cases[0]), true);
assert.equal(Object.isFrozen(audit.cases[0].verifierIds), true);
assert.equal(audit.cases[0].status, VERIFIER_CORRELATION_STATUSES.CORRELATED);
assert.equal(audit.cases[0].coveredLineages, 3);
assert.equal(audit.cases[0].distinctVerifierCount, 1);
assert.deepEqual(audit.cases[0].verifierIds, ['graph-path-verifier/v1']);
assert.equal(Object.hasOwn(audit, 'ensemble'), false);
assert.equal(Object.hasOwn(audit, 'lineages'), false);
assert.equal(Object.hasOwn(audit, 'runner'), false);
assert.equal(Object.hasOwn(audit, 'harness'), false);
assert.equal(Object.hasOwn(audit, 'actionReport'), false);
assert.equal(Object.hasOwn(audit, 'promotionAuthority'), false);

console.log(
  `FLUID_VERIFIER_CORRELATION_OK lineages=${audit.lineageCount} cases=${audit.caseCount} `
  + `correlated=${audit.correlatedCases} diverse=${audit.diverseCases} `
  + `unresolved=${audit.unresolvedCases} runtimeIndependent=${audit.runtimeIndependent} `
  + `reviewRequired=${audit.requiresVerifierReview} summaryOnly=`
  + `${audit.dataOnly && audit.historicalOnly} authorityTransferred=${audit.authorityTransferred}`
);
