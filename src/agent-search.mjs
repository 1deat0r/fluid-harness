import {
  BoundedAgentRunner,
  isTrustedAgentRunReport,
  isTrustedAgentRunner
} from './agent.mjs';
import {
  isTrustedAgentEpisodePlan,
  isTrustedAgentPlanner
} from './agent-plan.mjs';
import {
  EvaluationBudget,
  POLICY_MODES,
  isTrustedEvaluationBudget
} from './evaluation.mjs';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayFind,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arrayReduce,
  arraySlice,
  arraySome,
  arraySort,
  isFiniteNumber,
  isInstanceOf,
  isPlainObject,
  jsonStringify,
  maxNumber,
  objectFreeze,
  objectGetPrototypeOf,
  objectEntries,
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
import { isTrustedToolRegistry } from './tool.mjs';

const TRUSTED_AGENT_PLANNER_CANDIDATES = weakSetCreate();
const TRUSTED_AGENT_PLANNER_CASES = weakSetCreate();
const TRUSTED_AGENT_PLANNER_EVALUATION_REPORTS = weakSetCreate();
const TRUSTED_AGENT_PLANNER_SEARCH_RESULTS = weakSetCreate();
const TRUSTED_AGENT_PLANNER_SEARCH_REPORTS = weakSetCreate();
const TRUSTED_AGENT_PLANNER_SEARCH_RUNNERS = weakSetCreate();
const TRUSTED_AGENT_PLANNER_SEARCH_CONTEXTS = weakMapCreate();
const TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_REPORTS = weakSetCreate();
const TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_AUTHORITIES = weakMapCreate();
const TRUSTED_AGENT_PLANNER_PROMOTION_AUTHORITIES = weakSetCreate();
const TRUSTED_AGENT_PLANNER_PROMOTIONS = weakMapCreate();
const USED_AGENT_PLANNERS = weakSetCreate();
const PLANNER_REPRODUCIBILITY_TOKEN = objectFreeze({});
const PLANNER_PROMOTION_TOKEN = objectFreeze({});

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

function requireRate(value, field) {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return value;
}

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function plannerDefinitionFingerprint(planner) {
  const runner = planner.runner;
  return jsonStringify({
    plannerId: planner.plannerId,
    maxEpisodes: planner.maxEpisodes,
    maxToolCallsPerEpisode: planner.maxToolCallsPerEpisode,
    modulePath: runner.modulePath,
    exportName: runner.exportName,
    timeoutMs: runner.timeoutMs,
    maxInputBytes: runner.maxInputBytes,
    maxOutputBytes: runner.maxOutputBytes,
    workingDirectory: runner.workingDirectory,
    readRoots: runner.readRoots
  });
}

function evaluateExpectation(evaluationCase, report, error) {
  try {
    return toBoolean(evaluationCase.expected(report, error));
  } catch {
    return false;
  }
}

function transferMatrixFor(results) {
  const domains = arraySort(arrayReduce(
    results,
    (unique, result) => {
      if (!arrayIncludes(unique, result.domain)) {
        arrayPush(unique, result.domain);
      }
      return unique;
    },
    []
  ));
  return objectFreeze(arrayMap(domains, (domain) => {
    const domainResults = arrayFilter(results, (result) => result.domain === domain);
    const successes = arrayFilter(domainResults, (result) => result.success).length;
    const proofResults = arrayFilter(domainResults, (result) => result.requiresProof);
    const proven = arrayFilter(proofResults, (result) => result.proven).length;
    return objectFreeze({
      domain,
      cases: domainResults.length,
      successes,
      successRate: domainResults.length === 0 ? 0 : successes / domainResults.length,
      provenRate: proofResults.length === 0 ? null : proven / proofResults.length
    });
  }));
}

function samePlannerEvaluationEvidence(left, right) {
  if (
    left === null
    || right === null
    || left.mode !== right.mode
    || left.candidateId !== right.candidateId
    || left.budget.maxCases !== right.budget.maxCases
    || left.eligibleCases !== right.eligibleCases
    || left.attemptedCases !== right.attemptedCases
    || left.skippedCases !== right.skippedCases
    || left.successes !== right.successes
    || left.proofEligibleCases !== right.proofEligibleCases
    || left.proven !== right.proven
    || left.adversarialCases !== right.adversarialCases
    || left.adversarialSuccesses !== right.adversarialSuccesses
    || left.weaknessesExposed !== right.weaknessesExposed
    || !objectIs(left.successRate, right.successRate)
    || !objectIs(left.provenRate, right.provenRate)
    || !objectIs(left.adversarialSuccessRate, right.adversarialSuccessRate)
    || left.complete !== right.complete
    || left.definitionFingerprint !== right.definitionFingerprint
    || left.results.length !== right.results.length
    || left.transferMatrix.length !== right.transferMatrix.length
  ) {
    return false;
  }
  const resultFields = [
    'caseId',
    'domain',
    'plannerId',
    'proven',
    'expected',
    'success',
    'requiresProof',
    'adversarial',
    'stopReason',
    'error'
  ];
  const matchingResults = arrayEvery(left.results, (leftResult, index) => {
    const rightResult = right.results[index];
    return rightResult !== undefined
      && arrayEvery(resultFields, (field) => objectIs(leftResult[field], rightResult[field]));
  });
  const matchingTransfer = arrayEvery(left.transferMatrix, (leftEntry, index) => {
    const rightEntry = right.transferMatrix[index];
    return rightEntry !== undefined
      && arrayEvery(
        ['domain', 'cases', 'successes', 'successRate', 'provenRate'],
        (field) => objectIs(leftEntry[field], rightEntry[field])
      );
  });
  return matchingResults && matchingTransfer;
}

function samePlannerSearchResultEvidence(left, right) {
  return left !== null
    && right !== null
    && left.candidateId === right.candidateId
    && left.definitionFingerprint === right.definitionFingerprint
    && left.error === right.error
    && left.complete === right.complete
    && samePlannerEvaluationEvidence(left.production, right.production)
    && samePlannerEvaluationEvidence(left.research, right.research)
    && samePlannerEvaluationEvidence(left.skeptic, right.skeptic);
}

function searchContextFor(report) {
  return weakMapGet(TRUSTED_AGENT_PLANNER_SEARCH_CONTEXTS, report);
}

function samePlannerSearchContext(left, right) {
  const leftContext = searchContextFor(left);
  const rightContext = searchContextFor(right);
  if (
    leftContext === undefined
    || rightContext === undefined
    || leftContext.runner === rightContext.runner
    || leftContext.cases.length !== rightContext.cases.length
  ) {
    return false;
  }
  return arrayEvery(leftContext.cases, (evaluationCase, index) => (
    evaluationCase === rightContext.cases[index]
  )) && arrayEvery(
    ['production', 'research', 'skeptic'],
    (mode) => leftContext.budgets[mode].maxCases === rightContext.budgets[mode].maxCases
  );
}

function compareSearchResults(left, right) {
  const leftMetrics = [
    left.fitness.researchSuccessRate,
    left.fitness.researchProvenRate ?? 0,
    left.fitness.skepticSuccessRate ?? 0,
    left.fitness.productionSuccessRate
  ];
  const rightMetrics = [
    right.fitness.researchSuccessRate,
    right.fitness.researchProvenRate ?? 0,
    right.fitness.skepticSuccessRate ?? 0,
    right.fitness.productionSuccessRate
  ];
  for (let index = 0; index < leftMetrics.length; index += 1) {
    if (leftMetrics[index] !== rightMetrics[index]) {
      return rightMetrics[index] - leftMetrics[index];
    }
  }
  return stringLocaleCompare(left.candidateId, right.candidateId);
}

export class AgentPlannerCandidate {
  constructor({ id, description = '', planner, plannerFactory } = {}) {
    this.id = requireNonEmptyString(id, 'Agent planner candidate id');
    this.description = typeof description === 'string' ? stringTrim(description) : '';
    if (plannerFactory !== undefined) {
      this.plannerFactory = requireFactory(plannerFactory, 'Agent plannerFactory');
    } else if (planner !== undefined) {
      if (!isTrustedAgentPlanner(planner)) {
        throw new TypeError('Agent planner candidate requires a trusted planner');
      }
      this.plannerFactory = () => planner;
    } else {
      throw new TypeError('Agent planner candidate requires a planner or plannerFactory');
    }
    weakSetAdd(TRUSTED_AGENT_PLANNER_CANDIDATES, this);
    objectFreeze(this);
  }

  createPlanner() {
    const planner = this.plannerFactory();
    if (!isTrustedAgentPlanner(planner)) {
      throw new TypeError(`Agent planner candidate ${this.id} factory must return a trusted planner`);
    }
    return planner;
  }
}

export function isTrustedAgentPlannerCandidate(candidate) {
  return typeof candidate === 'object'
    && candidate !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_CANDIDATES, candidate)
    && objectGetPrototypeOf(candidate) === AgentPlannerCandidate.prototype;
}

export class AgentPlannerCase {
  constructor({
    id,
    domain,
    goal,
    context = null,
    task,
    expected,
    productionEligible = true,
    adversarial = false,
    requiresProof = true
  } = {}) {
    this.id = requireNonEmptyString(id, 'Agent planner case id');
    this.domain = requireNonEmptyString(domain, 'Agent planner case domain');
    this.goal = requireNonEmptyString(goal, 'Agent planner case goal');
    if (!isPlainObject(task)) {
      throw new TypeError('Agent planner case task must be a plain object');
    }
    this.task = snapshotProcessData({
      id: requireNonEmptyString(task.id, 'Agent planner case task id'),
      description: requireNonEmptyString(task.description, 'Agent planner case task description')
    });
    if (typeof expected !== 'function') {
      throw new TypeError('Agent planner case expected must be a function');
    }
    this.context = context === null ? null : snapshotProcessData(context);
    this.expected = expected;
    this.productionEligible = toBoolean(productionEligible);
    this.adversarial = toBoolean(adversarial);
    this.requiresProof = toBoolean(requiresProof);
    weakSetAdd(TRUSTED_AGENT_PLANNER_CASES, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerCase(evaluationCase) {
  return typeof evaluationCase === 'object'
    && evaluationCase !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_CASES, evaluationCase)
    && objectGetPrototypeOf(evaluationCase) === AgentPlannerCase.prototype;
}

function provenRun(report) {
  return isTrustedAgentRunReport(report)
    && report.cycles.length > 0
    && arrayEvery(report.cycles, (cycle) => cycle.action.evidence === EVIDENCE_LEVELS.PROVEN);
}

function resultFromRun({ evaluationCase, report, error }) {
  const expected = evaluateExpectation(evaluationCase, report, error);
  const proven = provenRun(report);
  const success = evaluationCase.requiresProof
    ? report !== null
      && report.completed === true
      && proven
      && expected
    : expected;
  return objectFreeze({
    caseId: evaluationCase.id,
    domain: evaluationCase.domain,
    plannerId: report?.plannerId ?? null,
    proven,
    expected,
    success,
    requiresProof: evaluationCase.requiresProof,
    adversarial: evaluationCase.adversarial,
    stopReason: report?.stopReason ?? null,
    error: error === null ? report?.error ?? null : error
  });
}

export class AgentPlannerEvaluationReport {
  constructor({ candidateId, mode, budget, eligibleCases, results, definitionFingerprint = null }) {
    this.candidateId = requireNonEmptyString(candidateId, 'Agent planner evaluation candidateId');
    if (!arrayIncludes(objectValues(POLICY_MODES), mode)) {
      throw new RangeError('Agent planner evaluation mode is invalid');
    }
    if (!isTrustedEvaluationBudget(budget)) {
      throw new TypeError('Agent planner evaluation requires a trusted budget');
    }
    if (!arrayIsArray(results) || results.length === 0) {
      throw new TypeError('Agent planner evaluation requires results');
    }
    this.mode = mode;
    this.budget = budget;
    this.definitionFingerprint = definitionFingerprint === null
      ? null
      : requireNonEmptyString(definitionFingerprint, 'Agent planner definitionFingerprint');
    this.eligibleCases = eligibleCases;
    this.results = objectFreeze(arraySlice(results));
    this.attemptedCases = results.length;
    this.skippedCases = maxNumber(0, eligibleCases - results.length);
    this.successes = arrayFilter(results, (result) => result.success).length;
    this.proofEligibleCases = arrayFilter(results, (result) => result.requiresProof).length;
    this.proven = arrayFilter(
      results,
      (result) => result.requiresProof && result.proven
    ).length;
    this.adversarialCases = arrayFilter(results, (result) => result.adversarial).length;
    this.adversarialSuccesses = arrayFilter(
      results,
      (result) => result.adversarial && result.success
    ).length;
    this.weaknessesExposed = this.adversarialCases - this.adversarialSuccesses;
    this.successRate = results.length === 0 ? 0 : this.successes / results.length;
    this.provenRate = this.proofEligibleCases === 0
      ? null
      : this.proven / this.proofEligibleCases;
    this.adversarialSuccessRate = this.adversarialCases === 0
      ? null
      : this.adversarialSuccesses / this.adversarialCases;
    this.complete = this.skippedCases === 0;
    this.transferMatrix = transferMatrixFor(results);
    weakSetAdd(TRUSTED_AGENT_PLANNER_EVALUATION_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerEvaluationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_EVALUATION_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentPlannerEvaluationReport.prototype;
}

export class AgentPlannerSearchResult {
  constructor({ candidate, production, research, skeptic, error = null }) {
    if (!isTrustedAgentPlannerCandidate(candidate)) {
      throw new TypeError('Agent planner search result requires a trusted candidate');
    }
    if (!isTrustedAgentPlannerEvaluationReport(production)
      || !isTrustedAgentPlannerEvaluationReport(research)
      || !isTrustedAgentPlannerEvaluationReport(skeptic)) {
      throw new TypeError('Agent planner search result requires three evaluation reports');
    }
    this.candidate = candidate;
    this.candidateId = candidate.id;
    this.description = candidate.description;
    this.production = production;
    this.research = research;
    this.skeptic = skeptic;
    this.definitionFingerprint = production.definitionFingerprint !== null
      && production.definitionFingerprint === research.definitionFingerprint
      && production.definitionFingerprint === skeptic.definitionFingerprint
      ? production.definitionFingerprint
      : null;
    this.error = error === null ? null : stringFrom(error);
    this.complete = this.error === null
      && production.complete
      && research.complete
      && skeptic.complete;
    this.fitness = objectFreeze({
      productionSuccessRate: production.successRate,
      productionProvenRate: production.provenRate ?? 0,
      researchSuccessRate: research.successRate,
      researchProvenRate: research.provenRate ?? 0,
      skepticSuccessRate: skeptic.adversarialSuccessRate ?? 0,
      skepticWeaknessesExposed: skeptic.weaknessesExposed,
      transferSuccessRate: arrayReduce(
        research.transferMatrix,
        (total, entry) => total + entry.successRate,
        0
      ) / research.transferMatrix.length,
      transferProvenRate: null
    });
    weakSetAdd(TRUSTED_AGENT_PLANNER_SEARCH_RESULTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerSearchResult(result) {
  return typeof result === 'object'
    && result !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_SEARCH_RESULTS, result)
    && objectGetPrototypeOf(result) === AgentPlannerSearchResult.prototype;
}

export class AgentPlannerSearchReport {
  constructor({ results }) {
    if (!arrayIsArray(results) || results.length === 0
      || arraySome(results, (result) => !isTrustedAgentPlannerSearchResult(result))) {
      throw new TypeError('Agent planner search report requires trusted results');
    }
    const ranked = arraySort(arraySlice(results), compareSearchResults);
    this.results = objectFreeze(ranked);
    this.winner = ranked[0];
    this.complete = arrayEvery(ranked, (result) => result.complete);
    this.allAuditsValid = this.complete;
    this.promoted = null;
    weakSetAdd(TRUSTED_AGENT_PLANNER_SEARCH_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerSearchReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_SEARCH_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentPlannerSearchReport.prototype;
}

export class AgentPlannerReproducibilityReport {
  constructor({
    authority,
    candidateId,
    primary,
    reproduction,
    reproducible,
    reasons = [],
    token
  }) {
    if (
      token !== PLANNER_REPRODUCIBILITY_TOKEN
      || !isTrustedAgentPlannerPromotionAuthority(authority)
    ) {
      throw new TypeError('Agent planner reproducibility reports require the trusted authority path');
    }
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Agent planner reproducibility candidateId'
    );
    if (
      !isTrustedAgentPlannerSearchReport(primary)
      || !isTrustedAgentPlannerSearchReport(reproduction)
    ) {
      throw new TypeError('Agent planner reproducibility requires trusted search reports');
    }
    if (!arrayIsArray(reasons) || arraySome(reasons, (reason) => typeof reason !== 'string')) {
      throw new TypeError('Agent planner reproducibility reasons must be strings');
    }
    this.primary = primary;
    this.reproduction = reproduction;
    this.reproducible = toBoolean(reproducible);
    this.reasons = objectFreeze(arraySlice(reasons));
    const primaryResult = arrayFind(
      primary.results,
      (result) => result.candidateId === this.candidateId
    );
    this.definitionFingerprint = primaryResult?.definitionFingerprint ?? null;
    weakSetAdd(TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_REPORTS, this);
    weakMapSet(TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_AUTHORITIES, this, authority);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerReproducibilityReport(report, authority = null) {
  const owner = typeof report === 'object' && report !== null
    ? weakMapGet(TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_AUTHORITIES, report)
    : undefined;
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_REPRODUCIBILITY_REPORTS, report)
    && owner !== undefined
    && (authority === null || owner === authority)
    && objectGetPrototypeOf(report) === AgentPlannerReproducibilityReport.prototype;
}

export class AgentPlannerPromotion {
  constructor({ authority, reproducibility, token }) {
    if (!isTrustedAgentPlannerPromotionAuthority(authority)) {
      throw new TypeError('Agent planner promotion requires a trusted promotion authority');
    }
    if (
      token !== PLANNER_PROMOTION_TOKEN
      || !isTrustedAgentPlannerReproducibilityReport(reproducibility, authority)
      || reproducibility.reproducible !== true
    ) {
      throw new TypeError('Agent planner promotion requires reproducible evidence');
    }
    const result = arrayFind(
      reproducibility.primary.results,
      (candidateResult) => candidateResult.candidateId === reproducibility.candidateId
    );
    if (!result || !isTrustedAgentPlannerCandidate(result.candidate)) {
      throw new TypeError('Agent planner promotion requires a trusted candidate result');
    }
    this.authority = authority;
    this.reproducibility = reproducibility;
    this.searchReport = reproducibility.primary;
    this.reproductionReport = reproducibility.reproduction;
    this.candidate = result.candidate;
    this.candidateId = result.candidateId;
    this.definitionFingerprint = result.definitionFingerprint;
    this.promoted = true;
    this.dataOnly = false;
    weakMapSet(TRUSTED_AGENT_PLANNER_PROMOTIONS, this, authority);
    objectFreeze(this);
  }
}

export function isTrustedAgentPlannerPromotion(promotion, authority = null) {
  const owner = typeof promotion === 'object' && promotion !== null
    ? weakMapGet(TRUSTED_AGENT_PLANNER_PROMOTIONS, promotion)
    : undefined;
  return typeof promotion === 'object'
    && promotion !== null
    && owner !== undefined
    && (authority === null || owner === authority)
    && objectGetPrototypeOf(promotion) === AgentPlannerPromotion.prototype;
}

export class AgentPlannerPromotionAuthority {
  constructor({
    minimumProductionSuccessRate = 1,
    minimumProductionProvenRate = 1,
    minimumResearchSuccessRate = 1,
    minimumResearchProvenRate = 1,
    minimumSkepticSuccessRate = 1
  } = {}) {
    this.minimumProductionSuccessRate = requireRate(
      minimumProductionSuccessRate,
      'Minimum planner production success rate'
    );
    this.minimumProductionProvenRate = requireRate(
      minimumProductionProvenRate,
      'Minimum planner production proven rate'
    );
    this.minimumResearchSuccessRate = requireRate(
      minimumResearchSuccessRate,
      'Minimum planner research success rate'
    );
    this.minimumResearchProvenRate = requireRate(
      minimumResearchProvenRate,
      'Minimum planner research proven rate'
    );
    this.minimumSkepticSuccessRate = requireRate(
      minimumSkepticSuccessRate,
      'Minimum planner skeptic success rate'
    );
    weakSetAdd(TRUSTED_AGENT_PLANNER_PROMOTION_AUTHORITIES, this);
    objectFreeze(this);
  }

  reproduce({ searchReport, reproductionReport, candidateId } = {}) {
    if (!isTrustedAgentPlannerPromotionAuthority(this)) {
      throw new TypeError('Agent planner reproducibility requires an exact trusted authority');
    }
    if (
      !isTrustedAgentPlannerSearchReport(searchReport)
      || !isTrustedAgentPlannerSearchReport(reproductionReport)
    ) {
      throw new TypeError('Agent planner reproducibility requires trusted search reports');
    }
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Agent planner reproducibility candidateId'
    );
    const reasons = [];
    const primary = arrayFind(
      searchReport.results,
      (result) => result.candidateId === normalizedCandidateId
    );
    const reproduction = arrayFind(
      reproductionReport.results,
      (result) => result.candidateId === normalizedCandidateId
    );
    if (searchReport === reproductionReport) {
      arrayPush(reasons, 'independent search report required');
    }
    if (!samePlannerSearchContext(searchReport, reproductionReport)) {
      arrayPush(reasons, 'search case or mode-budget contract differs');
    }
    if (!primary || !reproduction) {
      arrayPush(reasons, 'candidate must exist in both search reports');
    } else {
      if (primary.candidate !== reproduction.candidate) {
        arrayPush(reasons, 'candidate definition instance differs');
      }
      if (!samePlannerSearchResultEvidence(primary, reproduction)) {
        arrayPush(reasons, 'planner definition or per-case evidence differs');
      }
    }
    return new AgentPlannerReproducibilityReport({
      authority: this,
      candidateId: normalizedCandidateId,
      primary: searchReport,
      reproduction: reproductionReport,
      reproducible: reasons.length === 0,
      reasons,
      token: PLANNER_REPRODUCIBILITY_TOKEN
    });
  }

  promote(reproducibility) {
    if (!isTrustedAgentPlannerPromotionAuthority(this)) {
      throw new TypeError('Agent planner promotion requires an exact trusted authority');
    }
    if (!isTrustedAgentPlannerReproducibilityReport(reproducibility, this)) {
      throw new TypeError('Agent planner promotion requires a trusted reproducibility report');
    }
    const verifiedReproducibility = this.reproduce({
      searchReport: reproducibility.primary,
      reproductionReport: reproducibility.reproduction,
      candidateId: reproducibility.candidateId
    });
    const reasons = arraySlice(verifiedReproducibility.reasons);
    const primary = verifiedReproducibility.primary;
    const reproduction = verifiedReproducibility.reproduction;
    const result = arrayFind(
      primary.results,
      (candidateResult) => candidateResult.candidateId === reproducibility.candidateId
    );
    const reproductionResult = arrayFind(
      reproduction.results,
      (candidateResult) => candidateResult.candidateId === reproducibility.candidateId
    );
    if (!verifiedReproducibility.reproducible) {
      arrayPush(reasons, 'independent reproducibility evidence is required');
    }
    if (!result || !reproductionResult) {
      arrayPush(reasons, 'complete candidate results are required');
    } else {
      if (!result.complete || !reproductionResult.complete) {
        arrayPush(reasons, 'candidate search results must be complete');
      }
      if (!primary.complete || !reproduction.complete) {
        arrayPush(reasons, 'search reports must be complete');
      }
      if (!primary.allAuditsValid || !reproduction.allAuditsValid) {
        arrayPush(reasons, 'search report audits must be valid');
      }
      if (result.production.successRate < this.minimumProductionSuccessRate) {
        arrayPush(reasons, 'production success threshold not met');
      }
      if (
        (result.production.provenRate ?? 0) < this.minimumProductionProvenRate
      ) {
        arrayPush(reasons, 'production proof threshold not met');
      }
      if (result.research.successRate < this.minimumResearchSuccessRate) {
        arrayPush(reasons, 'research success threshold not met');
      }
      if ((result.research.provenRate ?? 0) < this.minimumResearchProvenRate) {
        arrayPush(reasons, 'research proof threshold not met');
      }
      if ((result.skeptic.adversarialSuccessRate ?? 0) < this.minimumSkepticSuccessRate) {
        arrayPush(reasons, 'skeptic success threshold not met');
      }
      if (result.skeptic.weaknessesExposed > 0) {
        arrayPush(reasons, 'skeptic exposed weaknesses');
      }
    }
    if (reasons.length > 0) {
      return objectFreeze({
        candidateId: reproducibility.candidateId,
        promoted: false,
        reasons: objectFreeze(reasons),
        promotion: null
      });
    }
    const promotion = new AgentPlannerPromotion({
      authority: this,
      reproducibility: verifiedReproducibility,
      token: PLANNER_PROMOTION_TOKEN
    });
    return objectFreeze({
      candidateId: reproducibility.candidateId,
      promoted: true,
      reasons: objectFreeze([]),
      promotion
    });
  }
}

export function isTrustedAgentPlannerPromotionAuthority(authority) {
  return typeof authority === 'object'
    && authority !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_PROMOTION_AUTHORITIES, authority)
    && objectGetPrototypeOf(authority) === AgentPlannerPromotionAuthority.prototype;
}

export function plannerFromPromotedSearch(promotion) {
  if (!isTrustedAgentPlannerPromotion(promotion)) {
    throw new TypeError('Promoted planner adoption requires a trusted planner promotion');
  }
  const planner = promotion.candidate.createPlanner();
  if (weakSetHas(USED_AGENT_PLANNERS, planner)) {
    throw new TypeError('Promoted planner adoption requires a fresh planner instance');
  }
  if (plannerDefinitionFingerprint(planner) !== promotion.definitionFingerprint) {
    throw new TypeError('Promoted planner adoption definition does not match replay evidence');
  }
  weakSetAdd(USED_AGENT_PLANNERS, planner);
  return planner;
}

function selectedCases(cases, mode, budget) {
  const eligible = mode === POLICY_MODES.PRODUCTION
    ? arrayFilter(cases, (evaluationCase) => evaluationCase.productionEligible)
    : mode === POLICY_MODES.SKEPTIC
      ? arrayFilter(cases, (evaluationCase) => evaluationCase.adversarial)
      : arraySlice(cases);
  if (eligible.length === 0) {
    throw new TypeError(`Agent planner evaluation policy ${mode} has no eligible cases`);
  }
  return {
    eligible,
    selected: arraySlice(eligible, 0, budget.maxCases)
  };
}

export class AgentPlannerSearchRunner {
  constructor({
    toolRegistryFactory = () => null,
    agentRunnerFactory = ({ toolRegistry }) => new BoundedAgentRunner({ toolRegistry })
  } = {}) {
    this.toolRegistryFactory = requireFactory(toolRegistryFactory, 'Agent planner toolRegistryFactory');
    this.agentRunnerFactory = requireFactory(agentRunnerFactory, 'Agent planner agentRunnerFactory');
    weakSetAdd(TRUSTED_AGENT_PLANNER_SEARCH_RUNNERS, this);
    objectFreeze(this);
  }

  evaluate({
    candidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget
  } = {}) {
    if (!isTrustedAgentPlannerSearchRunner(this)) {
      throw new TypeError('Agent planner search requires an exact trusted runner');
    }
    if (!arrayIsArray(candidates) || candidates.length === 0) {
      throw new TypeError('Agent planner search requires candidates');
    }
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Agent planner search requires cases');
    }
    const evaluationCases = arrayMap(cases, (evaluationCase) => {
      if (!isTrustedAgentPlannerCase(evaluationCase)) {
        throw new TypeError('Agent planner search cases must be trusted AgentPlannerCase instances');
      }
      return evaluationCase;
    });
    if (setSize(setFromArray(arrayMap(evaluationCases, ({ id }) => id))) !== evaluationCases.length) {
      throw new TypeError('Agent planner search case ids must be unique');
    }
    const normalizedCandidates = arrayMap(candidates, (candidate) => (
      isTrustedAgentPlannerCandidate(candidate)
        ? candidate
        : new AgentPlannerCandidate(candidate)
    ));
    if (setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id))) !== normalizedCandidates.length) {
      throw new TypeError('Agent planner candidate ids must be unique');
    }
    const budgets = {
      production: productionBudget ?? new EvaluationBudget({ maxCases: evaluationCases.length }),
      research: researchBudget ?? new EvaluationBudget({ maxCases: evaluationCases.length }),
      skeptic: skepticBudget ?? new EvaluationBudget({ maxCases: evaluationCases.length })
    };
    arrayEvery(objectEntries(budgets), (entry) => {
      if (!isTrustedEvaluationBudget(entry[1])) {
        throw new TypeError(`Agent planner ${entry[0]} budget must be trusted`);
      }
      return true;
    });

    const plannerFactories = setFromArray([]);
    const planners = setFromArray([]);
    const runners = setFromArray([]);
    const policies = setFromArray([]);
    const toolRegistries = setFromArray([]);
    const results = arrayMap(normalizedCandidates, (candidate) => {
      try {
        if (setHas(plannerFactories, candidate.plannerFactory)) {
          throw new TypeError(
            `Agent planner candidate ${candidate.id} must use a fresh planner factory across candidates`
          );
        }
        setAdd(plannerFactories, candidate.plannerFactory);
        const production = this.evaluateMode({
          candidate,
          cases: evaluationCases,
          mode: POLICY_MODES.PRODUCTION,
          budget: budgets.production,
          planners,
          runners,
          policies,
          toolRegistries
        });
        const research = this.evaluateMode({
          candidate,
          cases: evaluationCases,
          mode: POLICY_MODES.RESEARCH,
          budget: budgets.research,
          planners,
          runners,
          policies,
          toolRegistries
        });
        const skeptic = this.evaluateMode({
          candidate,
          cases: evaluationCases,
          mode: POLICY_MODES.SKEPTIC,
          budget: budgets.skeptic,
          planners,
          runners,
          policies,
          toolRegistries
        });
        return new AgentPlannerSearchResult({ candidate, production, research, skeptic });
      } catch (error) {
        const empty = new AgentPlannerEvaluationReport({
          candidateId: candidate.id,
          mode: POLICY_MODES.PRODUCTION,
          budget: budgets.production,
          eligibleCases: 1,
          results: [objectFreeze({
            caseId: `${candidate.id}-search-error`,
            domain: 'search',
            plannerId: null,
            proven: false,
            expected: false,
            success: false,
            requiresProof: true,
            adversarial: false,
            stopReason: null,
            error: errorMessage(error)
          })]
        });
        return new AgentPlannerSearchResult({
          candidate,
          production: empty,
          research: empty,
          skeptic: empty,
          error: errorMessage(error)
        });
      }
    });
    const report = new AgentPlannerSearchReport({ results });
    weakMapSet(TRUSTED_AGENT_PLANNER_SEARCH_CONTEXTS, report, objectFreeze({
      runner: this,
      cases: objectFreeze(arraySlice(evaluationCases)),
      budgets: objectFreeze({ ...budgets })
    }));
    return report;
  }

  evaluateMode({ candidate, cases, mode, budget, planners, runners, policies, toolRegistries }) {
    const { eligible, selected } = selectedCases(cases, mode, budget);
    const definitionFingerprints = [];
    const results = arrayMap(selected, (evaluationCase) => {
      let planner = null;
      let runner = null;
      try {
        planner = candidate.createPlanner();
        if (weakSetHas(USED_AGENT_PLANNERS, planner)) {
          throw new TypeError(`Agent planner ${candidate.id} reused a planner from a prior evaluation`);
        }
        if (setHas(planners, planner)) {
          throw new TypeError(`Agent planner ${candidate.id} reused a planner instance`);
        }
        setAdd(planners, planner);
        weakSetAdd(USED_AGENT_PLANNERS, planner);
        const definitionFingerprint = plannerDefinitionFingerprint(planner);
        if (!arrayIncludes(definitionFingerprints, definitionFingerprint)) {
          arrayPush(definitionFingerprints, definitionFingerprint);
        }
        const plan = planner.plan({
          goal: evaluationCase.goal,
          context: evaluationCase.context
        });
        if (!isTrustedAgentEpisodePlan(plan)) {
          throw new TypeError('Agent planner returned an untrusted episode plan');
        }
        const firstEpisode = plan.episodes[0];
        if (
          !firstEpisode
          || firstEpisode.task.id !== evaluationCase.task.id
          || firstEpisode.task.description !== evaluationCase.task.description
        ) {
          throw new TypeError('Agent planner plan task does not match the evaluation case');
        }
        const toolRegistry = this.toolRegistryFactory();
        if (toolRegistry !== null && !isTrustedToolRegistry(toolRegistry)) {
          throw new TypeError('Agent planner toolRegistryFactory must return a trusted ToolRegistry or null');
        }
        if (toolRegistry !== null) {
          if (setHas(toolRegistries, toolRegistry)) {
            throw new TypeError('Agent planner search reused a ToolRegistry instance');
          }
          setAdd(toolRegistries, toolRegistry);
        }
        runner = this.agentRunnerFactory({ toolRegistry });
        if (!isTrustedAgentRunner(runner)) {
          throw new TypeError('Agent planner agentRunnerFactory must return a trusted BoundedAgentRunner');
        }
        if (setHas(runners, runner)) {
          throw new TypeError('Agent planner search reused a runner instance');
        }
        setAdd(runners, runner);
        if (setHas(policies, runner.policy)) {
          throw new TypeError('Agent planner search reused an AgentPolicy instance');
        }
        setAdd(policies, runner.policy);
        const report = runner.runPlan({
          plan,
          stopOnResearchRequired: true,
          reproduction: `agent-planner-search:${mode}:${candidate.id}:${evaluationCase.id}`
        });
        return resultFromRun({ evaluationCase, report, error: null });
      } catch (error) {
        return resultFromRun({
          evaluationCase,
          report: null,
          error: errorMessage(error)
        });
      }
    });
    if (definitionFingerprints.length > 1) {
      throw new TypeError(`Agent planner ${candidate.id} changed definition within ${mode} evaluation`);
    }
    return new AgentPlannerEvaluationReport({
      candidateId: candidate.id,
      mode,
      budget,
      eligibleCases: eligible.length,
      results,
      definitionFingerprint: definitionFingerprints[0] ?? null
    });
  }
}

export function isTrustedAgentPlannerSearchRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_PLANNER_SEARCH_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentPlannerSearchRunner.prototype;
}

objectFreeze(AgentPlannerCandidate.prototype);
objectFreeze(AgentPlannerCase.prototype);
objectFreeze(AgentPlannerEvaluationReport.prototype);
objectFreeze(AgentPlannerSearchResult.prototype);
objectFreeze(AgentPlannerSearchReport.prototype);
objectFreeze(AgentPlannerSearchRunner.prototype);
objectFreeze(AgentPlannerReproducibilityReport.prototype);
objectFreeze(AgentPlannerPromotion.prototype);
objectFreeze(AgentPlannerPromotionAuthority.prototype);
