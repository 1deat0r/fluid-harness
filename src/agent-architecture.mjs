import {
  BoundedAgentRunner
} from './agent.mjs';
import {
  AgentPlannerCandidate,
  AgentPlannerSearchRunner,
  isTrustedAgentPlannerCandidate,
  isTrustedAgentPlannerSearchReport
} from './agent-search.mjs';
import {
  EvaluationBudget,
  isTrustedEvaluationBudget
} from './evaluation.mjs';
import {
  isTrustedAgentPolicy
} from './evolution.mjs';
import { isTrustedAgentPlanner } from './agent-plan.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayFind,
  arrayEvery,
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
  objectFreeze,
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
  weakSetAdd,
  weakSetCreate,
  weakSetHas,
  weakMapCreate,
  weakMapGet,
  weakMapSet
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_CANDIDATES = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_RESULTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_RUNNERS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_SEARCH_CONTEXTS = weakMapCreate();
const TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES = weakMapCreate();
const TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES_SET = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_ADOPTIONS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES = weakMapCreate();
const TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES_SET = weakSetCreate();
const ARCHITECTURE_REPRODUCIBILITY_TOKEN = objectFreeze({});
const ARCHITECTURE_ADOPTION_TOKEN = objectFreeze({});

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

function policyFingerprint(policy) {
  return jsonStringify({
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  });
}

function plannerDefinitionFingerprint(planner) {
  if (!isTrustedAgentPlanner(planner)) {
    throw new TypeError('Architecture planner definition requires a trusted planner');
  }
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

function architectureFingerprint(candidate, policyDefinitionFingerprint) {
  return jsonStringify({
    components: candidate.components,
    plannerCandidateId: candidate.plannerCandidate.id,
    policy: policyDefinitionFingerprint
  });
}

function resultForCandidate(report, plannerCandidateId) {
  return arrayFind(
    report?.results ?? [],
    (result) => result.candidateId === plannerCandidateId
  ) ?? null;
}

function plannerReportHasErrors(report) {
  if (!isTrustedAgentPlannerSearchReport(report)) {
    return true;
  }
  return arraySome(report.results, (result) => arraySome(
    [result.production, result.research, result.skeptic],
    (modeReport) => arraySome(modeReport.results, (caseResult) => caseResult.error !== null)
  ));
}

function samePlannerEvaluationReport(left, right) {
  if (
    !isTrustedAgentPlannerSearchReport(left)
    || !isTrustedAgentPlannerSearchReport(right)
  ) {
    return false;
  }
  return left.results.length === right.results.length
    && arrayEvery(left.results, (leftResult, index) => {
      const rightResult = right.results[index];
      if (
        rightResult === undefined
        || leftResult.candidateId !== rightResult.candidateId
        || leftResult.definitionFingerprint !== rightResult.definitionFingerprint
        || leftResult.error !== rightResult.error
        || leftResult.complete !== rightResult.complete
      ) {
        return false;
      }
      return arrayEvery(
        [leftResult.production, leftResult.research, leftResult.skeptic],
        (leftModeReport, modeIndex) => {
          const rightModeReport = [
            rightResult.production,
            rightResult.research,
            rightResult.skeptic
          ][modeIndex];
          if (
            leftModeReport.mode !== rightModeReport.mode
            || leftModeReport.budget.maxCases !== rightModeReport.budget.maxCases
            || leftModeReport.eligibleCases !== rightModeReport.eligibleCases
            || leftModeReport.attemptedCases !== rightModeReport.attemptedCases
            || leftModeReport.skippedCases !== rightModeReport.skippedCases
            || leftModeReport.successes !== rightModeReport.successes
            || leftModeReport.proofEligibleCases !== rightModeReport.proofEligibleCases
            || leftModeReport.proven !== rightModeReport.proven
            || leftModeReport.adversarialCases !== rightModeReport.adversarialCases
            || leftModeReport.adversarialSuccesses !== rightModeReport.adversarialSuccesses
            || leftModeReport.weaknessesExposed !== rightModeReport.weaknessesExposed
            || leftModeReport.definitionFingerprint !== rightModeReport.definitionFingerprint
            || !objectIs(leftModeReport.successRate, rightModeReport.successRate)
            || !objectIs(leftModeReport.provenRate, rightModeReport.provenRate)
            || !objectIs(leftModeReport.adversarialSuccessRate, rightModeReport.adversarialSuccessRate)
            || leftModeReport.complete !== rightModeReport.complete
            || leftModeReport.results.length !== rightModeReport.results.length
            || leftModeReport.transferMatrix.length !== rightModeReport.transferMatrix.length
          ) {
            return false;
          }
          const matchingCases = arrayEvery(leftModeReport.results, (leftCase, caseIndex) => {
            const rightCase = rightModeReport.results[caseIndex];
            return rightCase !== undefined && arrayEvery(
              [
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
              ],
                (field) => objectIs(leftCase[field], rightCase[field])
            );
          });
          const matchingTransfer = arrayEvery(
            leftModeReport.transferMatrix,
            (leftEntry, transferIndex) => {
              const rightEntry = rightModeReport.transferMatrix[transferIndex];
              return rightEntry !== undefined && arrayEvery(
                ['domain', 'cases', 'successes', 'successRate', 'provenRate'],
                (field) => objectIs(leftEntry[field], rightEntry[field])
              );
            }
          );
          return matchingCases && matchingTransfer;
        }
      );
    });
}

function searchContextFor(report) {
  return weakMapGet(TRUSTED_AGENT_ARCHITECTURE_SEARCH_CONTEXTS, report);
}

function sameArchitectureSearchContext(left, right) {
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

function sameArchitectureResultEvidence(left, right) {
  if (
    left.architectureId !== right.architectureId
    || left.error !== right.error
    || left.complete !== right.complete
    || left.policyDefinitionFingerprint !== right.policyDefinitionFingerprint
    || left.architectureFingerprint !== right.architectureFingerprint
  ) {
    return false;
  }
  return arrayEvery(
    [
      'productionSuccessRate',
      'productionProvenRate',
      'researchSuccessRate',
      'researchProvenRate',
      'skepticSuccessRate',
      'skepticWeaknessesExposed',
      'transferSuccessRate'
    ],
    (field) => objectIs(left.fitness[field], right.fitness[field])
  ) && samePlannerEvaluationReport(left.plannerReport, right.plannerReport);
}

function compareArchitectureResults(left, right) {
  const leftMetrics = [
    left.fitness.researchSuccessRate,
    left.fitness.researchProvenRate,
    left.fitness.skepticSuccessRate,
    left.fitness.productionSuccessRate,
    left.fitness.productionProvenRate
  ];
  const rightMetrics = [
    right.fitness.researchSuccessRate,
    right.fitness.researchProvenRate,
    right.fitness.skepticSuccessRate,
    right.fitness.productionSuccessRate,
    right.fitness.productionProvenRate
  ];
  for (let index = 0; index < leftMetrics.length; index += 1) {
    if (leftMetrics[index] !== rightMetrics[index]) {
      return rightMetrics[index] - leftMetrics[index];
    }
  }
  return stringLocaleCompare(left.architectureId, right.architectureId);
}

export class AgentArchitectureCandidate {
  constructor({
    id,
    description = '',
    plannerCandidate,
    policyFactory,
    components = {}
  } = {}) {
    this.id = requireNonEmptyString(id, 'Agent architecture candidate id');
    this.description = typeof description === 'string' ? stringTrim(description) : '';
    if (!isTrustedAgentPlannerCandidate(plannerCandidate)) {
      throw new TypeError('Agent architecture candidate requires a trusted planner candidate');
    }
    this.plannerCandidate = plannerCandidate;
    this.policyFactory = requireFactory(policyFactory, 'Agent architecture policyFactory');
    if (!isPlainObject(components)) {
      throw new TypeError('Agent architecture components must be a plain object');
    }
    this.components = snapshotProcessData(components);
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_CANDIDATES, this);
    objectFreeze(this);
  }

  createPolicy() {
    const policy = this.policyFactory();
    if (!isTrustedAgentPolicy(policy)) {
      throw new TypeError(
        `Agent architecture candidate ${this.id} policyFactory must return a trusted AgentPolicy`
      );
    }
    return policy;
  }
}

export function isTrustedAgentArchitectureCandidate(candidate) {
  return typeof candidate === 'object'
    && candidate !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_CANDIDATES, candidate)
    && objectGetPrototypeOf(candidate) === AgentArchitectureCandidate.prototype;
}

export class AgentArchitectureSearchResult {
  constructor({ candidate, plannerReport = null, policyDefinitionFingerprint = null, error = null }) {
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError('Agent architecture search result requires a trusted candidate');
    }
    if (plannerReport !== null && !isTrustedAgentPlannerSearchReport(plannerReport)) {
      throw new TypeError('Agent architecture search result requires a trusted planner report');
    }
    this.candidate = candidate;
    this.architectureId = candidate.id;
    this.description = candidate.description;
    this.plannerReport = plannerReport;
    this.policyDefinitionFingerprint = policyDefinitionFingerprint;
    this.architectureFingerprint = policyDefinitionFingerprint === null
      ? null
      : architectureFingerprint(candidate, policyDefinitionFingerprint);
    this.error = error === null ? null : stringFrom(error);
    const plannerResult = resultForCandidate(plannerReport, candidate.plannerCandidate.id);
    this.complete = this.error === null
      && plannerReport !== null
      && plannerReport.complete === true
      && plannerResult !== null
      && plannerResult.complete === true
      && !plannerReportHasErrors(plannerReport);
    this.fitness = objectFreeze({
      productionSuccessRate: plannerResult?.fitness.productionSuccessRate ?? 0,
      productionProvenRate: plannerResult?.fitness.productionProvenRate ?? 0,
      researchSuccessRate: plannerResult?.fitness.researchSuccessRate ?? 0,
      researchProvenRate: plannerResult?.fitness.researchProvenRate ?? 0,
      skepticSuccessRate: plannerResult?.fitness.skepticSuccessRate ?? 0,
      skepticWeaknessesExposed: plannerResult?.fitness.skepticWeaknessesExposed ?? 0,
      transferSuccessRate: plannerResult?.fitness.transferSuccessRate ?? 0
    });
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_RESULTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureSearchResult(result) {
  return typeof result === 'object'
    && result !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_RESULTS, result)
    && objectGetPrototypeOf(result) === AgentArchitectureSearchResult.prototype;
}

export class AgentArchitectureSearchReport {
  constructor({ results }) {
    if (
      !arrayIsArray(results)
      || results.length === 0
      || arraySome(results, (result) => !isTrustedAgentArchitectureSearchResult(result))
    ) {
      throw new TypeError('Agent architecture search report requires trusted results');
    }
    const ranked = arraySort(arraySlice(results), compareArchitectureResults);
    this.results = objectFreeze(ranked);
    this.winner = ranked[0];
    this.promoted = null;
    this.allAuditsValid = arrayEveryArchitectureReport(ranked, (result) => (
      result.plannerReport !== null && result.plannerReport.allAuditsValid === true
    ));
    this.complete = this.allAuditsValid && arrayEveryArchitectureReport(
      ranked,
      (result) => result.complete
    );
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_REPORTS, this);
    objectFreeze(this);
  }
}

function arrayEveryArchitectureReport(values, predicate) {
  return arrayReduce(values, (all, value) => all && predicate(value), true);
}

export function isTrustedAgentArchitectureSearchReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureSearchReport.prototype;
}

export class AgentArchitectureReproducibilityReport {
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
      token !== ARCHITECTURE_REPRODUCIBILITY_TOKEN
      || !isTrustedAgentArchitectureReproducibilityAuthority(authority)
    ) {
      throw new TypeError('Architecture reproducibility reports require the trusted authority path');
    }
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Architecture reproducibility candidateId'
    );
    if (
      !isTrustedAgentArchitectureSearchReport(primary)
      || !isTrustedAgentArchitectureSearchReport(reproduction)
    ) {
      throw new TypeError('Architecture reproducibility requires trusted search reports');
    }
    if (!arrayIsArray(reasons) || arraySome(reasons, (reason) => typeof reason !== 'string')) {
      throw new TypeError('Architecture reproducibility reasons must be strings');
    }
    this.primary = primary;
    this.reproduction = reproduction;
    this.reproducible = reproducible === true;
    this.reasons = objectFreeze(arraySlice(reasons));
    const primaryResult = arrayFind(
      primary.results,
      (result) => result.architectureId === this.candidateId
    );
    this.architectureFingerprint = primaryResult?.architectureFingerprint ?? null;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_REPORTS, this);
    weakMapSet(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES, this, authority);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureReproducibilityReport(report, authority = null) {
  const owner = typeof report === 'object' && report !== null
    ? weakMapGet(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES, report)
    : undefined;
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_REPORTS, report)
    && owner !== undefined
    && (authority === null || owner === authority)
    && objectGetPrototypeOf(report) === AgentArchitectureReproducibilityReport.prototype;
}

export class AgentArchitectureReproducibilityAuthority {
  constructor() {
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES_SET, this);
    objectFreeze(this);
  }

  reproduce({ searchReport, reproductionReport, candidateId } = {}) {
    if (!isTrustedAgentArchitectureReproducibilityAuthority(this)) {
      throw new TypeError('Architecture reproducibility requires an exact trusted authority');
    }
    if (
      !isTrustedAgentArchitectureSearchReport(searchReport)
      || !isTrustedAgentArchitectureSearchReport(reproductionReport)
    ) {
      throw new TypeError('Architecture reproducibility requires trusted search reports');
    }
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Architecture reproducibility candidateId'
    );
    const reasons = [];
    const primary = arrayFind(
      searchReport.results,
      (result) => result.architectureId === normalizedCandidateId
    );
    const reproduction = arrayFind(
      reproductionReport.results,
      (result) => result.architectureId === normalizedCandidateId
    );
    if (searchReport === reproductionReport) {
      arrayPush(reasons, 'independent architecture search report required');
    }
    if (!sameArchitectureSearchContext(searchReport, reproductionReport)) {
      arrayPush(reasons, 'architecture suite or mode-budget contract differs');
    }
    if (searchReport.complete !== true || reproductionReport.complete !== true) {
      arrayPush(reasons, 'complete architecture search reports are required');
    }
    if (!primary || !reproduction) {
      arrayPush(reasons, 'architecture candidate must exist in both reports');
    } else {
      if (primary.candidate !== reproduction.candidate) {
        arrayPush(reasons, 'architecture candidate definition instance differs');
      }
      if (!sameArchitectureResultEvidence(primary, reproduction)) {
        arrayPush(reasons, 'architecture fingerprint or per-case evidence differs');
      }
    }
    return new AgentArchitectureReproducibilityReport({
      authority: this,
      candidateId: normalizedCandidateId,
      primary: searchReport,
      reproduction: reproductionReport,
      reproducible: reasons.length === 0,
      reasons,
      token: ARCHITECTURE_REPRODUCIBILITY_TOKEN
    });
  }
}

export function isTrustedAgentArchitectureReproducibilityAuthority(authority) {
  return typeof authority === 'object'
    && authority !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_REPRODUCIBILITY_AUTHORITIES_SET, authority)
    && objectGetPrototypeOf(authority) === AgentArchitectureReproducibilityAuthority.prototype;
}

export class AgentArchitectureAdoption {
  constructor({ authority, reproducibility, candidate, token }) {
    if (
      token !== ARCHITECTURE_ADOPTION_TOKEN
      || !isTrustedAgentArchitectureAdoptionAuthority(authority)
      || !isTrustedAgentArchitectureReproducibilityReport(reproducibility)
      || reproducibility.reproducible !== true
      || !isTrustedAgentArchitectureCandidate(candidate)
    ) {
      throw new TypeError('Architecture adoption requires trusted replay evidence');
    }
    this.authority = authority;
    this.reproducibility = reproducibility;
    this.candidate = candidate;
    this.candidateId = candidate.id;
    this.architectureFingerprint = reproducibility.architectureFingerprint;
    this.adopted = true;
    this.deployed = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_ADOPTIONS, this);
    weakMapSet(TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES, this, authority);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureAdoption(adoption, authority = null) {
  const owner = typeof adoption === 'object' && adoption !== null
    ? weakMapGet(TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES, adoption)
    : undefined;
  return typeof adoption === 'object'
    && adoption !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_ADOPTIONS, adoption)
    && owner !== undefined
    && (authority === null || owner === authority)
    && objectGetPrototypeOf(adoption) === AgentArchitectureAdoption.prototype;
}

export class AgentArchitectureAdoptionAuthority {
  constructor({
    minimumProductionSuccessRate = 1,
    minimumProductionProvenRate = 1,
    minimumResearchSuccessRate = 1,
    minimumResearchProvenRate = 1,
    minimumSkepticSuccessRate = 1,
    minimumTransferSuccessRate = 1
  } = {}) {
    this.minimumProductionSuccessRate = requireRate(
      minimumProductionSuccessRate,
      'Minimum architecture production success rate'
    );
    this.minimumProductionProvenRate = requireRate(
      minimumProductionProvenRate,
      'Minimum architecture production proven rate'
    );
    this.minimumResearchSuccessRate = requireRate(
      minimumResearchSuccessRate,
      'Minimum architecture research success rate'
    );
    this.minimumResearchProvenRate = requireRate(
      minimumResearchProvenRate,
      'Minimum architecture research proven rate'
    );
    this.minimumSkepticSuccessRate = requireRate(
      minimumSkepticSuccessRate,
      'Minimum architecture skeptic success rate'
    );
    this.minimumTransferSuccessRate = requireRate(
      minimumTransferSuccessRate,
      'Minimum architecture transfer success rate'
    );
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES_SET, this);
    objectFreeze(this);
  }

  adopt(reproducibility) {
    if (!isTrustedAgentArchitectureAdoptionAuthority(this)) {
      throw new TypeError('Architecture adoption requires an exact trusted authority');
    }
    if (!isTrustedAgentArchitectureReproducibilityReport(reproducibility)) {
      throw new TypeError('Architecture adoption requires a trusted reproducibility report');
    }
    const verificationAuthority = new AgentArchitectureReproducibilityAuthority();
    const verifiedReproducibility = verificationAuthority.reproduce({
      searchReport: reproducibility.primary,
      reproductionReport: reproducibility.reproduction,
      candidateId: reproducibility.candidateId
    });
    const reasons = arraySlice(verifiedReproducibility.reasons);
    const candidateId = verifiedReproducibility.candidateId;
    const result = arrayFind(
      verifiedReproducibility.primary.results,
      (candidateResult) => candidateResult.architectureId === candidateId
    );
    if (!verifiedReproducibility.reproducible) {
      arrayPush(reasons, 'independent architecture reproducibility evidence is required');
    }
    if (!result || !isTrustedAgentArchitectureCandidate(result.candidate)) {
      arrayPush(reasons, 'complete trusted architecture result is required');
    } else {
      const plannerResult = resultForCandidate(
        result.plannerReport,
        result.candidate.plannerCandidate.id
      );
      if (!result.complete || !plannerResult?.complete) {
        arrayPush(reasons, 'architecture search result must be complete');
      }
      if (!verifiedReproducibility.primary.complete || !verifiedReproducibility.reproduction.complete) {
        arrayPush(reasons, 'architecture search reports must be complete');
      }
      if (
        !verifiedReproducibility.primary.allAuditsValid
        || !verifiedReproducibility.reproduction.allAuditsValid
      ) {
        arrayPush(reasons, 'architecture search report audits must be valid');
      }
      if (result.fitness.productionSuccessRate < this.minimumProductionSuccessRate) {
        arrayPush(reasons, 'architecture production success threshold not met');
      }
      if (result.fitness.productionProvenRate < this.minimumProductionProvenRate) {
        arrayPush(reasons, 'architecture production proof threshold not met');
      }
      if (result.fitness.researchSuccessRate < this.minimumResearchSuccessRate) {
        arrayPush(reasons, 'architecture research success threshold not met');
      }
      if (result.fitness.researchProvenRate < this.minimumResearchProvenRate) {
        arrayPush(reasons, 'architecture research proof threshold not met');
      }
      if (result.fitness.skepticSuccessRate < this.minimumSkepticSuccessRate) {
        arrayPush(reasons, 'architecture skeptic success threshold not met');
      }
      if (result.fitness.transferSuccessRate < this.minimumTransferSuccessRate) {
        arrayPush(reasons, 'architecture transfer threshold not met');
      }
      if (result.fitness.skepticWeaknessesExposed > 0) {
        arrayPush(reasons, 'architecture skeptic exposed weaknesses');
      }
      if (
        result.architectureFingerprint === null
        || architectureFingerprint(result.candidate, result.policyDefinitionFingerprint)
          !== result.architectureFingerprint
      ) {
        arrayPush(reasons, 'architecture fingerprint is not self-consistent');
      }
      if (reasons.length === 0) {
        try {
          const policy = result.candidate.createPolicy();
          if (policyFingerprint(policy) !== result.policyDefinitionFingerprint) {
            arrayPush(reasons, 'architecture policy definition changed after replay');
          }
          const planner = result.candidate.plannerCandidate.createPlanner();
          if (
            !plannerResult
            || plannerDefinitionFingerprint(planner) !== plannerResult.definitionFingerprint
          ) {
            arrayPush(reasons, 'architecture planner definition changed after replay');
          }
        } catch (error) {
          arrayPush(reasons, `architecture fresh dependency validation failed: ${errorMessage(error)}`);
        }
      }
    }
    if (reasons.length > 0) {
      return objectFreeze({
        candidateId,
        adopted: false,
        reasons: objectFreeze(reasons),
        adoption: null
      });
    }
    const sourceCandidate = result.candidate;
    const freshPlannerCandidate = new AgentPlannerCandidate({
      id: sourceCandidate.plannerCandidate.id,
      description: sourceCandidate.plannerCandidate.description,
      plannerFactory: () => sourceCandidate.plannerCandidate.createPlanner()
    });
    const freshCandidate = new AgentArchitectureCandidate({
      id: sourceCandidate.id,
      description: sourceCandidate.description,
      plannerCandidate: freshPlannerCandidate,
      policyFactory: () => sourceCandidate.createPolicy(),
      components: sourceCandidate.components
    });
    const adoption = new AgentArchitectureAdoption({
      authority: this,
      reproducibility: verifiedReproducibility,
      candidate: freshCandidate,
      token: ARCHITECTURE_ADOPTION_TOKEN
    });
    return objectFreeze({
      candidateId,
      adopted: true,
      reasons: objectFreeze([]),
      adoption
    });
  }
}

export function isTrustedAgentArchitectureAdoptionAuthority(authority) {
  return typeof authority === 'object'
    && authority !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_ADOPTION_AUTHORITIES_SET, authority)
    && objectGetPrototypeOf(authority) === AgentArchitectureAdoptionAuthority.prototype;
}

export function architectureFromAdoptedSearch(adoption) {
  if (!isTrustedAgentArchitectureAdoption(adoption)) {
    throw new TypeError('Adopted architecture access requires trusted adoption evidence');
  }
  return adoption.candidate;
}

export class AgentArchitectureSearchRunner {
  constructor({ toolRegistryFactory = () => null } = {}) {
    this.toolRegistryFactory = requireFactory(
      toolRegistryFactory,
      'Agent architecture toolRegistryFactory'
    );
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_RUNNERS, this);
    objectFreeze(this);
  }

  evaluate({
    candidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget
  } = {}) {
    if (!isTrustedAgentArchitectureSearchRunner(this)) {
      throw new TypeError('Agent architecture search requires an exact trusted runner');
    }
    if (!arrayIsArray(candidates) || candidates.length === 0) {
      throw new TypeError('Agent architecture search requires candidates');
    }
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Agent architecture search requires cases');
    }
    const normalizedCandidates = arrayMap(candidates, (candidate) => {
      if (!isTrustedAgentArchitectureCandidate(candidate)) {
        throw new TypeError('Agent architecture candidates must be trusted instances');
      }
      return candidate;
    });
    if (
      setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id)))
      !== normalizedCandidates.length
    ) {
      throw new TypeError('Agent architecture candidate ids must be unique');
    }
    const plannerCandidates = setFromArray([]);
    const policyFactories = setFromArray([]);
    const normalizedCases = arraySlice(cases);
    const budgets = {
      production: productionBudget ?? new EvaluationBudget({ maxCases: normalizedCases.length }),
      research: researchBudget ?? new EvaluationBudget({ maxCases: normalizedCases.length }),
      skeptic: skepticBudget ?? new EvaluationBudget({ maxCases: normalizedCases.length })
    };
    if (arraySome(objectValues(budgets), (budget) => !isTrustedEvaluationBudget(budget))) {
      throw new TypeError('Agent architecture search budgets must be trusted EvaluationBudget instances');
    }
    const results = arrayMap(normalizedCandidates, (candidate) => {
      const policyFingerprints = [];
      try {
        if (setHas(plannerCandidates, candidate.plannerCandidate)) {
          throw new TypeError(
            `Architecture candidate ${candidate.id} reused a planner candidate`
          );
        }
        setAdd(plannerCandidates, candidate.plannerCandidate);
        if (setHas(policyFactories, candidate.policyFactory)) {
          throw new TypeError(
            `Architecture candidate ${candidate.id} reused a policy factory`
          );
        }
        setAdd(policyFactories, candidate.policyFactory);
        const plannerRunner = new AgentPlannerSearchRunner({
          toolRegistryFactory: this.toolRegistryFactory,
          agentRunnerFactory: ({ toolRegistry }) => {
            const policy = candidate.createPolicy();
            const fingerprint = policyFingerprint(policy);
            if (!arrayIncludes(policyFingerprints, fingerprint)) {
              arrayPush(policyFingerprints, fingerprint);
            }
            return new BoundedAgentRunner({ toolRegistry, policy });
          }
        });
        const plannerReport = plannerRunner.evaluate({
          candidates: [candidate.plannerCandidate],
          cases: normalizedCases,
          productionBudget: budgets.production,
          researchBudget: budgets.research,
          skepticBudget: budgets.skeptic
        });
        if (policyFingerprints.length > 1) {
          throw new TypeError(
            `Architecture candidate ${candidate.id} changed policy definition during evaluation`
          );
        }
        return new AgentArchitectureSearchResult({
          candidate,
          plannerReport,
          policyDefinitionFingerprint: policyFingerprints[0] ?? null
        });
      } catch (error) {
        return new AgentArchitectureSearchResult({
          candidate,
          error: errorMessage(error)
        });
      }
    });
    const report = new AgentArchitectureSearchReport({ results });
    weakMapSet(TRUSTED_AGENT_ARCHITECTURE_SEARCH_CONTEXTS, report, objectFreeze({
      runner: this,
      cases: objectFreeze(arraySlice(normalizedCases)),
      budgets: objectFreeze({ ...budgets })
    }));
    return report;
  }
}

export function isTrustedAgentArchitectureSearchRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureSearchRunner.prototype;
}

objectFreeze(AgentArchitectureCandidate.prototype);
objectFreeze(AgentArchitectureSearchResult.prototype);
objectFreeze(AgentArchitectureSearchReport.prototype);
objectFreeze(AgentArchitectureReproducibilityReport.prototype);
objectFreeze(AgentArchitectureReproducibilityAuthority.prototype);
objectFreeze(AgentArchitectureAdoption.prototype);
objectFreeze(AgentArchitectureAdoptionAuthority.prototype);
objectFreeze(AgentArchitectureSearchRunner.prototype);
