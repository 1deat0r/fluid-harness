import {
  Constitution,
  ConstitutionalCore,
  isTrustedConstitution
} from './constitution.mjs';
import {
  EvaluationBudget,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority,
  isTrustedEvaluationBudget,
  isTrustedPromotionAuthority
} from './evaluation.mjs';
import { FluidHarness } from './harness.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayFind,
  arrayForEach,
  arrayIsArray,
  arrayJoin,
  arrayMap,
  arrayPush,
  arrayReduce,
  arraySlice,
  arraySome,
  arraySort,
  functionToString,
  isFrozenObject,
  isInstanceOf,
  mapFromEntries,
  mapGet,
  objectFreeze,
  objectEntries,
  objectGetPrototypeOf,
  objectIs,
  objectValues,
  setAdd,
  setFromArray,
  setHas,
  setSize,
  stringFrom,
  stringLocaleCompare,
  stringTrim,
  toBoolean,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_SEARCH_REPORTS = weakSetCreate();
const TRUSTED_SEARCH_SUITES = weakMapCreate();
const TRUSTED_SEARCH_RUNNERS = weakSetCreate();
const TRUSTED_REPRESENTATION_CANDIDATES = weakSetCreate();
const USED_SEARCH_SELECTORS = weakSetCreate();
const CONSTITUTION_LIMIT_FIELDS = objectFreeze([
  'maxActions',
  'maxGraphExpansions',
  'maxAuditEntries',
  'maxInputBytes',
  'maxGraphNodes',
  'maxGraphEdges',
  'maxConstraintJobs',
  'maxArrayElements',
  'maxSurpriseThreshold'
]);
const PROMOTION_AUTHORITY_FIELDS = objectFreeze([
  'minimumSuccessRate',
  'minimumProvenRate',
  'requireResearch',
  'requireSkeptic'
]);

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireFactory(value, field) {
  if (typeof value !== 'function') {
    throw new TypeError(`${field} must be a function`);
  }
  return value;
}

function constitutionFingerprint(constitution) {
  return arrayJoin(
    arrayMap(CONSTITUTION_LIMIT_FIELDS, (field) => `${field}=${constitution[field]}`),
    '|'
  );
}

function promotionAuthorityFingerprint(authority) {
  return arrayJoin(
    arrayMap(PROMOTION_AUTHORITY_FIELDS, (field) => `${field}=${authority[field]}`),
    '|'
  );
}

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function rate(value) {
  return value === null ? 0 : value;
}

function average(values) {
  return values.length === 0
    ? 0
    : arrayReduce(values, (total, value) => total + value, 0) / values.length;
}

function transferMetrics(report) {
  const domains = objectValues(report?.transferMatrix ?? {});
  const provenDomains = arrayFilter(
    arrayMap(domains, ({ provenRate }) => provenRate),
    (value) => value !== null
  );
  return {
    transferDomains: domains.length,
    transferSuccessRate: average(arrayMap(domains, ({ successRate }) => successRate)),
    transferProvenRate: average(provenDomains)
  };
}

function completeEvaluationReport(report) {
  return report !== null
    && report !== undefined
    && report.complete === true;
}

function selectorDefinitionFingerprint(selector) {
  const prototype = objectGetPrototypeOf(selector);
  const constructorName = typeof prototype?.constructor?.name === 'string'
    ? prototype.constructor.name
    : '';
  const selectSource = functionToString(selector.select);
  return `${constructorName}|${selectSource}`;
}

function sameProductionEvidence(expected, actual) {
  if (!completeEvaluationReport(expected) || !completeEvaluationReport(actual)) {
    return false;
  }
  if (
    expected.successRate !== actual.successRate
    || expected.provenRate !== actual.provenRate
    || expected.results.length !== actual.results.length
  ) {
    return false;
  }

  const actualResults = mapFromEntries(arrayMap(actual.results, (result) => [result.caseId, result]));
  return arrayEvery(expected.results, (expectedResult) => {
    const actualResult = mapGet(actualResults, expectedResult.caseId);
    return actualResult !== undefined
      && actualResult.success === expectedResult.success
      && actualResult.proven === expectedResult.proven
      && actualResult.representation === expectedResult.representation
      && actualResult.error === expectedResult.error;
  });
}

function sameEvaluationCaseEvidence(expected, actual) {
  const fields = [
    'caseId',
    'domain',
    'representation',
    'proven',
    'expected',
    'success',
    'requiresProof',
    'adversarial',
    'verifierId',
    'error'
  ];
  const actualResults = mapFromEntries(arrayMap(actual.results, (result) => [result.caseId, result]));
  return arrayEvery(expected.results, (expectedResult) => {
    const actualResult = mapGet(actualResults, expectedResult.caseId);
    return actualResult !== undefined
      && arrayEvery(fields, (field) => objectIs(expectedResult[field], actualResult[field]));
  });
}

function sameCompleteEvaluationEvidence(expected, actual) {
  return expected.results.length === actual.results.length
    && sameEvaluationCaseEvidence(expected, actual);
}

function evaluateSelectorForAdoption(selector, candidateId, suite, mode) {
  return new EvaluationRunner({
    harness: new FluidHarness({ selector })
  }).evaluate({
    candidateId,
    cases: suite,
    mode,
    budget: new EvaluationBudget({ maxCases: suite.length })
  });
}

function compareResults(left, right) {
  const leftMetrics = [
    left.promoted ? 1 : 0,
    left.fitness.researchSuccessRate,
    left.fitness.researchProvenRate,
    left.fitness.skepticSuccessRate,
    left.fitness.transferSuccessRate,
    left.fitness.transferProvenRate,
    left.fitness.productionSuccessRate
  ];
  const rightMetrics = [
    right.promoted ? 1 : 0,
    right.fitness.researchSuccessRate,
    right.fitness.researchProvenRate,
    right.fitness.skepticSuccessRate,
    right.fitness.transferSuccessRate,
    right.fitness.transferProvenRate,
    right.fitness.productionSuccessRate
  ];

  for (let index = 0; index < leftMetrics.length; index += 1) {
    if (leftMetrics[index] !== rightMetrics[index]) {
      return rightMetrics[index] - leftMetrics[index];
    }
  }
  return stringLocaleCompare(left.candidateId, right.candidateId);
}

export class RepresentationCandidate {
  constructor({ id, description = '', selector, selectorFactory }) {
    this.id = requireNonEmptyString(id, 'Representation candidate id');
    this.description = typeof description === 'string' ? stringTrim(description) : '';
    if (selectorFactory !== undefined) {
      this.selectorFactory = requireFactory(selectorFactory, 'Representation selectorFactory');
    } else {
      if (!selector || typeof selector.select !== 'function') {
        throw new TypeError('Representation candidate requires a selector or selectorFactory');
      }
      this.selectorFactory = () => selector;
    }
    weakSetAdd(TRUSTED_REPRESENTATION_CANDIDATES, this);
    objectFreeze(this);
  }

  createSelector() {
    const selector = this.selectorFactory();
    if (!selector || typeof selector.select !== 'function') {
      throw new TypeError(`Candidate ${this.id} factory must return a selector`);
    }
    return selector;
  }
}

objectFreeze(RepresentationCandidate.prototype);

export function isTrustedRepresentationCandidate(candidate) {
  return typeof candidate === 'object'
    && candidate !== null
    && weakSetHas(TRUSTED_REPRESENTATION_CANDIDATES, candidate)
    && objectGetPrototypeOf(candidate) === RepresentationCandidate.prototype;
}

export class CandidateSearchResult {
  constructor({
    candidate,
    production = null,
    research = null,
    skeptic = null,
    decision = null,
    auditValid = false,
    error = null,
    definitionFingerprint = null
  }) {
    if (!isTrustedRepresentationCandidate(candidate)) {
      throw new TypeError('CandidateSearchResult requires a RepresentationCandidate');
    }

    this.candidate = candidate;
    this.candidateId = candidate.id;
    this.description = candidate.description;
    this.production = production;
    this.research = research;
    this.skeptic = skeptic;
    this.decision = decision;
    this.auditValid = toBoolean(auditValid);
    this.error = error === null ? null : stringFrom(error);
    this.definitionFingerprint = definitionFingerprint === null
      ? null
      : stringFrom(definitionFingerprint);
    this.promoted = this.auditValid
      && this.error === null
      && completeEvaluationReport(production)
      && completeEvaluationReport(research)
      && completeEvaluationReport(skeptic)
      && toBoolean(decision?.promoted);
    const transfer = transferMetrics(research);
    this.fitness = objectFreeze({
      productionSuccessRate: production === null ? 0 : production.successRate,
      productionProvenRate: production === null ? 0 : rate(production.provenRate),
      researchSuccessRate: research === null ? 0 : research.successRate,
      researchProvenRate: research === null ? 0 : rate(research.provenRate),
      skepticSuccessRate: skeptic === null ? 0 : rate(skeptic.adversarialSuccessRate),
      skepticWeaknessesExposed: skeptic === null ? 0 : skeptic.weaknessesExposed,
      ...transfer
    });
    objectFreeze(this);
  }
}

export class RepresentationSearchReport {
  constructor({ results }) {
    if (!arrayIsArray(results) || results.length === 0) {
      throw new TypeError('RepresentationSearchReport requires results');
    }
    if (arraySome(results, (result) => !isInstanceOf(result, CandidateSearchResult))) {
      throw new TypeError('Representation search results must be CandidateSearchResult instances');
    }

    const ranked = arraySort(arraySlice(results), compareResults);
    this.results = objectFreeze(ranked);
    this.winner = ranked[0];
    this.promoted = arrayFind(ranked, ({ promoted }) => promoted) ?? null;
    this.allAuditsValid = arrayEvery(ranked, ({ auditValid }) => auditValid);
    this.complete = this.allAuditsValid && arrayEvery(ranked, ({ error, production, research, skeptic }) => (
      error === null
      && completeEvaluationReport(production)
      && completeEvaluationReport(research)
      && completeEvaluationReport(skeptic)
    ));
    objectFreeze(this);
  }
}

export function isTrustedSearchReport(report) {
  return typeof report === 'object'
    && report !== null
    && isFrozenObject(report)
    && weakSetHas(TRUSTED_SEARCH_REPORTS, report);
}

export function isCompleteSearchReport(report) {
  return isTrustedSearchReport(report) && report.complete === true;
}

export function sameSearchSuite(left, right) {
  const leftSuite = weakMapGet(TRUSTED_SEARCH_SUITES, left);
  const rightSuite = weakMapGet(TRUSTED_SEARCH_SUITES, right);
  return arrayIsArray(leftSuite)
    && arrayIsArray(rightSuite)
    && leftSuite.length === rightSuite.length
    && arrayEvery(leftSuite, (evaluationCase, index) => evaluationCase === rightSuite[index]);
}

export function selectorFromPromotedSearch(report) {
  if (!isCompleteSearchReport(report)) {
    throw new TypeError('Promoted selector adoption requires a complete trusted search report');
  }
  if (!report.promoted || report.promoted.promoted !== true) {
    throw new Error('Search report has no promoted candidate to adopt');
  }
  const selector = report.promoted.candidate.createSelector();
  if (weakSetHas(USED_SEARCH_SELECTORS, selector)) {
    throw new TypeError(
      'Promoted selector adoption requires a fresh selector not used during search or prior adoption'
    );
  }
  const suite = weakMapGet(TRUSTED_SEARCH_SUITES, report);
  const expectedProduction = report.promoted.production;
  const validation = evaluateSelectorForAdoption(
    selector,
    report.promoted.candidateId,
    suite,
    POLICY_MODES.PRODUCTION
  );
  if (!sameProductionEvidence(expectedProduction, validation)) {
    throw new TypeError(
      'Promoted selector adoption failed production evidence revalidation'
    );
  }
  const researchValidation = evaluateSelectorForAdoption(
    selector,
    report.promoted.candidateId,
    suite,
    POLICY_MODES.RESEARCH
  );
  if (!sameCompleteEvaluationEvidence(report.promoted.research, researchValidation)) {
    throw new TypeError(
      'Promoted selector adoption failed research evidence revalidation'
    );
  }
  const productionReplay = evaluateSelectorForAdoption(
    selector,
    report.promoted.candidateId,
    suite,
    POLICY_MODES.PRODUCTION
  );
  if (!sameProductionEvidence(expectedProduction, productionReplay)) {
    throw new TypeError(
      'Promoted selector adoption failed production stability replay'
    );
  }
  const researchReplay = evaluateSelectorForAdoption(
    selector,
    report.promoted.candidateId,
    suite,
    POLICY_MODES.RESEARCH
  );
  if (!sameCompleteEvaluationEvidence(report.promoted.research, researchReplay)) {
    throw new TypeError(
      'Promoted selector adoption failed research stability replay'
    );
  }
  weakSetAdd(USED_SEARCH_SELECTORS, selector);
  return selector;
}

export class RepresentationSearchRunner {
  constructor({
    constitutionFactory = () => new Constitution(),
    promotionAuthorityFactory = () => new PromotionAuthority()
  } = {}) {
    this.constitutionFactory = requireFactory(constitutionFactory, 'Representation constitutionFactory');
    this.promotionAuthorityFactory = requireFactory(
      promotionAuthorityFactory,
      'Representation promotionAuthorityFactory'
    );
    weakSetAdd(TRUSTED_SEARCH_RUNNERS, this);
    objectFreeze(this);
  }

  evaluate({
    candidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget
  }) {
    if (!arrayIsArray(candidates) || candidates.length === 0) {
      throw new TypeError('Representation search requires candidates');
    }
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Representation search requires cases');
    }
    const evaluationCases = objectFreeze(arraySlice(cases));

    const normalizedCandidates = arrayMap(candidates, (candidate) => isTrustedRepresentationCandidate(candidate)
      ? candidate
      : new RepresentationCandidate(candidate));
    if (setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id))) !== normalizedCandidates.length) {
      throw new TypeError('Representation candidate ids must be unique');
    }

    const budgets = {
      production: productionBudget ?? new EvaluationBudget({ maxCases: cases.length }),
      research: researchBudget ?? new EvaluationBudget({ maxCases: cases.length }),
      skeptic: skepticBudget ?? new EvaluationBudget({ maxCases: cases.length })
    };
    arrayForEach(objectEntries(budgets), (entry) => {
      const name = entry[0];
      const budget = entry[1];
      if (!isTrustedEvaluationBudget(budget)) {
        throw new TypeError(`Representation ${name} budget must be a trusted EvaluationBudget`);
      }
    });

    const selectors = setFromArray([]);
    const promotionAuthorities = setFromArray([]);
    const selectorFactories = setFromArray([]);
    const constitutionFingerprints = setFromArray([]);
    const promotionAuthorityFingerprints = setFromArray([]);
    const results = arrayMap(normalizedCandidates, (candidate) => {
      const cores = [];
      const selectorDefinitions = [];
      try {
        if (setHas(selectorFactories, candidate.selectorFactory)) {
          throw new TypeError(
            `Candidate ${candidate.id} must use a fresh selector factory across candidates`
          );
        }
        setAdd(selectorFactories, candidate.selectorFactory);
        const createModeCore = () => {
          const selector = candidate.createSelector();
          arrayPush(selectorDefinitions, selectorDefinitionFingerprint(selector));
          if (setHas(selectors, selector) || weakSetHas(USED_SEARCH_SELECTORS, selector)) {
            throw new TypeError(
              `Candidate ${candidate.id} must return a fresh selector for each policy mode and candidate`
            );
          }
          setAdd(selectors, selector);
          weakSetAdd(USED_SEARCH_SELECTORS, selector);
          const constitution = this.constitutionFactory();
          if (!isTrustedConstitution(constitution)) {
            throw new TypeError('Representation constitutionFactory must return a trusted Constitution');
          }
          const fingerprint = constitutionFingerprint(constitution);
          if (setSize(constitutionFingerprints) > 0 && !setHas(constitutionFingerprints, fingerprint)) {
            throw new TypeError(
              'Representation constitutionFactory returned inconsistent limits across candidate evaluations'
            );
          }
          setAdd(constitutionFingerprints, fingerprint);
          const promotionAuthority = this.promotionAuthorityFactory();
          if (!isTrustedPromotionAuthority(promotionAuthority)) {
            throw new TypeError(
              'Representation promotionAuthorityFactory must return a trusted PromotionAuthority'
            );
          }
          const authorityFingerprint = promotionAuthorityFingerprint(promotionAuthority);
          if (
            setSize(promotionAuthorityFingerprints) > 0
            && !setHas(promotionAuthorityFingerprints, authorityFingerprint)
          ) {
            throw new TypeError(
              'Representation promotionAuthorityFactory returned inconsistent thresholds across candidate evaluations'
            );
          }
          setAdd(promotionAuthorityFingerprints, authorityFingerprint);
          if (setHas(promotionAuthorities, promotionAuthority)) {
            throw new TypeError(
              `Candidate ${candidate.id} must receive a fresh promotion authority for each policy mode and candidate`
            );
          }
          setAdd(promotionAuthorities, promotionAuthority);
          const core = new ConstitutionalCore({
            constitution,
            harness: new FluidHarness({ selector }),
            promotionAuthority
          });
          arrayPush(cores, core);
          return core;
        };
        const productionCore = createModeCore();
        const production = productionCore.evaluate({
          candidateId: candidate.id,
          cases: evaluationCases,
          mode: POLICY_MODES.PRODUCTION,
          budget: budgets.production
        });
        const researchCore = createModeCore();
        const research = researchCore.evaluate({
          candidateId: candidate.id,
          cases: evaluationCases,
          mode: POLICY_MODES.RESEARCH,
          budget: budgets.research
        });
        const skepticCore = createModeCore();
        const skeptic = skepticCore.evaluate({
          candidateId: candidate.id,
          cases: evaluationCases,
          mode: POLICY_MODES.SKEPTIC,
          budget: budgets.skeptic
        });
        if (
          !sameEvaluationCaseEvidence(skeptic, research)
        ) {
          throw new TypeError(
            `Candidate ${candidate.id} returned inconsistent selector definitions across policy modes`
          );
        }
        const decision = researchCore.promote(research, {
          skepticReport: skeptic,
          productionReport: production
        });
        return new CandidateSearchResult({
          candidate,
          production,
          research,
          skeptic,
          decision,
          auditValid: cores.length === 3 && arrayEvery(cores, (core) => core.verifyAudit()),
          definitionFingerprint: arrayJoin(selectorDefinitions, '\u0000')
        });
      } catch (error) {
        return new CandidateSearchResult({
          candidate,
          auditValid: cores.length > 0 && arrayEvery(cores, (core) => core.verifyAudit()),
          error: errorMessage(error)
        });
      }
    });

    const report = new RepresentationSearchReport({ results });
    weakSetAdd(TRUSTED_SEARCH_REPORTS, report);
    weakMapSet(TRUSTED_SEARCH_SUITES, report, evaluationCases);
    return report;
  }
}

objectFreeze(RepresentationSearchRunner.prototype);

export function isTrustedSearchRunner(searchRunner) {
  return typeof searchRunner === 'object'
    && searchRunner !== null
    && weakSetHas(TRUSTED_SEARCH_RUNNERS, searchRunner)
    && objectGetPrototypeOf(searchRunner) === RepresentationSearchRunner.prototype;
}
