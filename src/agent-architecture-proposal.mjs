import {
  AgentArchitectureCandidate,
  isTrustedAgentArchitectureCandidate
} from './agent-architecture.mjs';
import {
  AgentPlannerCandidate,
  isTrustedAgentPlannerCandidate
} from './agent-search.mjs';
import { AgentPolicy } from './evolution.mjs';
import { isTrustedStructuredMemoryContext } from './memory.mjs';
import {
  isTrustedProcessRunner,
  snapshotProcessData
} from './process-boundary.mjs';
import {
  arrayForEach,
  arrayFilter,
  arrayFind,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySome,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectKeys,
  objectValues,
  reflectOwnKeys,
  setFromArray,
  setSize,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const ARCHITECTURE_PROPOSAL_SOURCES = objectFreeze({
  PROCESS_ISOLATED: 'PROCESS_ISOLATED'
});

const PROPOSAL_KEYS = objectFreeze([
  'id',
  'plannerCandidateId',
  'policy',
  'components'
]);
const PROPOSAL_RUN_KEYS = objectFreeze([
  'goal',
  'plannerCandidateIds',
  'researchContext'
]);
const POLICY_KEYS = objectFreeze(['maxEpisodes', 'maxToolCallsPerEpisode']);
const TRUSTED_AGENT_ARCHITECTURE_PROPOSALS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_RUNNERS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requirePositiveInteger(value, field) {
  if (!isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}

function requireAllowedKeys(value, allowed, field) {
  if (arraySome(objectKeys(value), (key) => !arrayIncludes(allowed, key))) {
    throw new TypeError(`${field} contains an unsupported property`);
  }
}

function requireDataObject(value, field, allowedKeys) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${field} must be a plain object`);
  }
  arrayForEach(reflectOwnKeys(value), (key) => {
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (
      typeof key === 'symbol'
      || !descriptor?.enumerable
      || descriptor.get
      || descriptor.set
      || !arrayIncludes(allowedKeys, key)
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function researchSummary(researchContext) {
  if (researchContext === null) {
    return null;
  }
  if (!isPlainObject(researchContext)) {
    throw new TypeError(
      'Agent architecture proposal research context summary must be a plain object'
    );
  }
  const normalizedResearchContext = snapshotProcessData(researchContext);
  if (
    normalizedResearchContext.source !== 'STRUCTURED_MEMORY'
    || !isSafeInteger(normalizedResearchContext.resultCount)
    || normalizedResearchContext.resultCount < 0
    || !isPlainObject(normalizedResearchContext.sourceCounts)
    || normalizedResearchContext.dataOnly !== true
    || normalizedResearchContext.historicalOnly !== true
    || normalizedResearchContext.authorityTransferred !== false
  ) {
    throw new TypeError('Agent architecture proposal research context summary is invalid');
  }
  const sourceCounts = normalizedResearchContext.sourceCounts;
  let sourceCountTotal = 0;
  arrayForEach(objectKeys(sourceCounts), (source) => {
    const count = sourceCounts[source];
    if (!isSafeInteger(count) || count < 0) {
      throw new TypeError(
        'Agent architecture proposal research context source counts are invalid'
      );
    }
    sourceCountTotal += count;
  });
  if (sourceCountTotal !== normalizedResearchContext.resultCount) {
    throw new TypeError('Agent architecture proposal research context source counts are invalid');
  }
  const provenanceInput = arrayIsArray(normalizedResearchContext.results)
    ? arrayMap(
      arrayFilter(
        normalizedResearchContext.results,
        (result) => result?.provenance !== null && result?.provenance !== undefined
      ),
      ({ provenance }) => provenance
    )
    : normalizedResearchContext.provenance ?? [];
  if (!arrayIsArray(provenanceInput)) {
    throw new TypeError('Agent architecture proposal research provenance is invalid');
  }
  let provenance = objectFreeze(arrayMap(provenanceInput, (locator) => {
    if (
      !isPlainObject(locator)
      || objectKeys(locator).length !== 3
      || !arrayIncludes(objectKeys(locator), 'hash')
      || !arrayIncludes(objectKeys(locator), 'kind')
      || !arrayIncludes(objectKeys(locator), 'sequence')
      || typeof locator.hash !== 'string'
      || stringTrim(locator.hash) === ''
      || typeof locator.kind !== 'string'
      || stringTrim(locator.kind) === ''
      || !isSafeInteger(locator.sequence)
      || locator.sequence <= 0
    ) {
      throw new TypeError('Agent architecture proposal research provenance is invalid');
    }
    return objectFreeze({
      hash: locator.hash,
      kind: locator.kind,
      sequence: locator.sequence
    });
  }));
  const provenanceKeys = arrayMap(
    provenance,
    ({ hash, kind, sequence }) => `${kind}:${sequence}:${hash}`
  );
  if (setSize(setFromArray(provenanceKeys)) !== provenance.length) {
    if (!arrayIsArray(normalizedResearchContext.results)) {
      throw new TypeError('Agent architecture proposal research provenance is duplicated');
    }
    const seenProvenance = [];
    provenance = objectFreeze(arrayFilter(provenance, (_locator, index) => {
      const key = provenanceKeys[index];
      if (arrayIncludes(seenProvenance, key)) {
        return false;
      }
      arrayPush(seenProvenance, key);
      return true;
    }));
  }
  return objectFreeze({
    source: normalizedResearchContext.source,
    query: normalizedResearchContext.query,
    sourceCounts,
    resultCount: normalizedResearchContext.resultCount,
    provenance,
    dataOnly: true,
    historicalOnly: true,
    authorityTransferred: false
  });
}

export class AgentArchitectureProposal {
  constructor(proposal = {}) {
    if (!isPlainObject(proposal)) {
      throw new TypeError('Agent architecture proposal must be a plain object');
    }
    requireAllowedKeys(proposal, PROPOSAL_KEYS, 'Agent architecture proposal');
    const {
      id,
      plannerCandidateId,
      policy = {},
      components = {}
    } = proposal;
    this.id = requireNonEmptyString(id, 'Agent architecture proposal id');
    this.plannerCandidateId = requireNonEmptyString(
      plannerCandidateId,
      'Agent architecture proposal plannerCandidateId'
    );
    if (!isPlainObject(policy)) {
      throw new TypeError('Agent architecture proposal policy must be a plain object');
    }
    requireAllowedKeys(policy, POLICY_KEYS, 'Agent architecture proposal policy');
    if (!isPlainObject(components)) {
      throw new TypeError('Agent architecture proposal components must be a plain object');
    }
    this.policy = snapshotProcessData(policy);
    this.components = snapshotProcessData(components);
    this.dataOnly = true;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_PROPOSALS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureProposal(proposal) {
  return typeof proposal === 'object'
    && proposal !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_PROPOSALS, proposal)
    && objectGetPrototypeOf(proposal) === AgentArchitectureProposal.prototype;
}

export class AgentArchitectureProposalReport {
  constructor({
    goal,
    proposals,
    source = ARCHITECTURE_PROPOSAL_SOURCES.PROCESS_ISOLATED,
    researchContext = null
  }) {
    this.goal = requireNonEmptyString(goal, 'Agent architecture proposal goal');
    if (!arrayIsArray(proposals) || proposals.length === 0) {
      throw new TypeError('Agent architecture proposal report requires proposals');
    }
    if (arraySome(proposals, (proposal) => !isTrustedAgentArchitectureProposal(proposal))) {
      throw new TypeError('Agent architecture proposal report requires trusted proposals');
    }
    if (!arrayIncludes(objectValues(ARCHITECTURE_PROPOSAL_SOURCES), source)) {
      throw new TypeError('Agent architecture proposal source is invalid');
    }
    this.source = source;
    this.proposals = objectFreeze(arraySlice(proposals));
    this.researchContext = researchSummary(researchContext);
    this.dataOnly = true;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureProposalReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureProposalReport.prototype;
}

export class AgentArchitectureProposalRunner {
  constructor({ runner, maxProposals = 8 } = {}) {
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('Agent architecture proposal runner requires a trusted process runner');
    }
    this.runner = runner;
    this.maxProposals = requirePositiveInteger(maxProposals, 'Agent architecture maxProposals');
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_RUNNERS, this);
    objectFreeze(this);
  }

  propose(options = {}) {
    const normalizedOptions = requireDataObject(
      options,
      'Agent architecture proposal options',
      PROPOSAL_RUN_KEYS
    );
    if (!isTrustedAgentArchitectureProposalRunner(this)) {
      throw new TypeError('Agent architecture proposal requires an exact trusted runner');
    }
    const {
      goal,
      plannerCandidateIds = [],
      researchContext = null
    } = normalizedOptions;
    const normalizedGoal = requireNonEmptyString(goal, 'Agent architecture proposal goal');
    if (
      researchContext !== null
      && !isTrustedStructuredMemoryContext(researchContext)
    ) {
      throw new TypeError(
        'Agent architecture proposal researchContext requires a trusted structured memory context'
      );
    }
    if (!arrayIsArray(plannerCandidateIds)) {
      throw new TypeError('Agent architecture proposal plannerCandidateIds must be an array');
    }
    const normalizedPlannerIds = arrayMap(
      plannerCandidateIds,
      (id, index) => requireNonEmptyString(id, `plannerCandidateIds[${index}]`)
    );
    if (
      setSize(setFromArray(normalizedPlannerIds)) !== normalizedPlannerIds.length
    ) {
      throw new TypeError('Agent architecture plannerCandidateIds must be unique');
    }
    const response = this.runner.run(snapshotProcessData({
      goal: normalizedGoal,
      plannerCandidateIds: normalizedPlannerIds,
      researchContext: researchContext === null
        ? null
        : researchContext.toPlannerData()
    })).value;
    if (!isPlainObject(response) || !arrayIsArray(response.proposals)) {
      throw new TypeError('Architecture proposer must return a proposals array');
    }
    if (response.proposals.length === 0) {
      throw new TypeError('Architecture proposer must return at least one proposal');
    }
    if (response.proposals.length > this.maxProposals) {
      throw new RangeError(
        `Architecture proposer returned ${response.proposals.length} proposals; maximum is ${this.maxProposals}`
      );
    }
    const proposals = arrayMap(
      response.proposals,
      (proposal) => new AgentArchitectureProposal(proposal)
    );
    if (setSize(setFromArray(arrayMap(proposals, ({ id }) => id))) !== proposals.length) {
      throw new TypeError('Architecture proposal ids must be unique');
    }
    return new AgentArchitectureProposalReport({
      goal: normalizedGoal,
      proposals,
      researchContext: researchContext === null
        ? null
        : researchSummary(researchContext.toPlannerData())
    });
  }

  resolve({ report, plannerCandidates } = {}) {
    if (!isTrustedAgentArchitectureProposalRunner(this)) {
      throw new TypeError('Agent architecture resolution requires an exact trusted runner');
    }
    if (!isTrustedAgentArchitectureProposalReport(report)) {
      throw new TypeError('Agent architecture resolution requires a trusted proposal report');
    }
    if (!arrayIsArray(plannerCandidates) || plannerCandidates.length === 0) {
      throw new TypeError('Agent architecture resolution requires planner candidates');
    }
    const trustedCandidates = arrayMap(plannerCandidates, (candidate) => {
      if (!isTrustedAgentPlannerCandidate(candidate)) {
        throw new TypeError('Agent architecture resolution requires trusted planner candidates');
      }
      return candidate;
    });
    if (setSize(setFromArray(arrayMap(trustedCandidates, ({ id }) => id))) !== trustedCandidates.length) {
      throw new TypeError('Agent architecture resolution planner candidate ids must be unique');
    }
    return objectFreeze(arrayMap(report.proposals, (proposal) => {
      const registeredPlannerCandidate = arrayFind(
        trustedCandidates,
        (candidate) => candidate.id === proposal.plannerCandidateId
      );
      if (!registeredPlannerCandidate) {
        throw new RangeError(
          `Architecture proposal ${proposal.id} references unknown planner candidate ${proposal.plannerCandidateId}`
        );
      }
      new AgentPolicy(proposal.policy);
      const plannerCandidate = new AgentPlannerCandidate({
        id: registeredPlannerCandidate.id,
        description: registeredPlannerCandidate.description,
        plannerFactory: () => registeredPlannerCandidate.createPlanner()
      });
      return new AgentArchitectureCandidate({
        id: proposal.id,
        description: `Process-isolated proposal for ${proposal.plannerCandidateId}`,
        plannerCandidate,
        policyFactory: () => new AgentPolicy(proposal.policy),
        components: proposal.components
      });
    }));
  }
}

export function isTrustedAgentArchitectureProposalRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_PROPOSAL_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureProposalRunner.prototype;
}

objectFreeze(AgentArchitectureProposal.prototype);
objectFreeze(AgentArchitectureProposalReport.prototype);
objectFreeze(AgentArchitectureProposalRunner.prototype);
