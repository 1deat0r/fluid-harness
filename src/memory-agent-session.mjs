import { isTrustedAgentArchitectureAdoption } from './agent-architecture.mjs';
import {
  AgentArchitectureDiscoveryRunner,
  isTrustedAgentArchitectureDiscoveryReport
} from './agent-architecture-discovery.mjs';
import {
  isTrustedAgentArchitectureProposalRunner
} from './agent-architecture-proposal.mjs';
import { isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentCoordinationReport,
  MemoryAwareAgentCoordinationRunner
} from './memory-agent-coordination.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayForEach,
  arrayIncludes,
  isFrozenObject,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_MEMORY_AGENT_SESSION_REPORTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_SESSION_RUNNERS = weakSetCreate();
const SESSION_TOKEN = objectFreeze({});
const MEMORY_AGENT_SESSION_RUN_KEYS = objectFreeze([
  'adoptionAuthority',
  'agentGoal',
  'architectureGoal',
  'cases',
  'context',
  'ledger',
  'plannerCandidates',
  'productionBudget',
  'query',
  'reproduction',
  'researchBudget',
  'skepticBudget'
]);

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

function discoverySummaryFor(discovery) {
  if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
    throw new TypeError('Memory-aware session requires a trusted discovery report');
  }
  const adopted = discovery.adopted === true;
  return snapshotProcessData({
    goal: discovery.goal,
    complete: discovery.complete,
    adopted,
    reproducible: discovery.reproducibility.reproducible === true,
    winnerId: discovery.winnerId,
    architectureId: adopted ? discovery.adoption.adoption.candidateId : null,
    architectureFingerprint: adopted
      ? discovery.adoption.adoption.architectureFingerprint
      : null,
    proposalCount: discovery.proposals.length,
    candidateCount: discovery.candidates.length,
    dataOnly: true,
    authorityTransferred: false
  });
}

export class MemoryAwareAgentSessionReport {
  constructor({
    runner,
    discoverySummary,
    coordination,
    architectureGoal,
    agentGoal,
    query,
    context,
    reproduction,
    token
  }) {
    if (
      token !== SESSION_TOKEN
      || !isTrustedMemoryAwareAgentSessionRunner(runner)
      || !isPlainObject(discoverySummary)
      || discoverySummary.complete !== true
      || discoverySummary.adopted !== true
      || discoverySummary.reproducible !== true
      || typeof discoverySummary.architectureFingerprint !== 'string'
      || !isTrustedMemoryAwareAgentCoordinationReport(coordination)
      || !isPlainObject(query)
      || !isPlainObject(context)
    ) {
      throw new TypeError('Memory-aware session requires trusted finite orchestration evidence');
    }
    this.discoverySummary = discoverySummary;
    this.coordination = coordination;
    this.architectureGoal = requireNonEmptyString(
      architectureGoal,
      'Memory-aware session architectureGoal'
    );
    this.agentGoal = requireNonEmptyString(agentGoal, 'Memory-aware session agentGoal');
    this.query = query;
    this.context = context;
    this.reproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware session reproduction'
    );
    this.architectureId = discoverySummary.architectureId;
    this.architectureFingerprint = discoverySummary.architectureFingerprint;
    this.adopted = true;
    this.freshAgents = true;
    this.finalQuorumMet = coordination.finalQuorumMet;
    this.allRoundsProven = coordination.allRoundsProven;
    this.persistenceComplete = coordination.persistenceComplete;
    this.ledgerLengthBefore = coordination.ledgerLengthBefore;
    this.ledgerLengthAfter = coordination.ledgerLengthAfter;
    this.deployed = false;
    this.constitutionalMutation = false;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_MEMORY_AGENT_SESSION_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentSessionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SESSION_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === MemoryAwareAgentSessionReport.prototype;
}

export class MemoryAwareAgentSessionRunner {
  constructor({
    proposalRunner,
    adoptionAuthority = undefined,
    agentCount = 2,
    maxRounds = 2,
    minimumProvenAgents = agentCount
  } = {}) {
    if (!isTrustedAgentArchitectureProposalRunner(proposalRunner)) {
      throw new TypeError('Memory-aware session requires a trusted proposal runner');
    }
    this.agentCount = requirePositiveInteger(
      agentCount,
      'Memory-aware session agentCount'
    );
    this.maxRounds = requirePositiveInteger(maxRounds, 'Memory-aware session maxRounds');
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Memory-aware session minimumProvenAgents'
    );
    this.discoveryRunner = new AgentArchitectureDiscoveryRunner({
      proposalRunner,
      ...(adoptionAuthority === undefined ? {} : { adoptionAuthority })
    });
    this.coordinationRunner = new MemoryAwareAgentCoordinationRunner({
      agentCount: this.agentCount,
      maxRounds: this.maxRounds,
      minimumProvenAgents: this.minimumProvenAgents
    });
    weakSetAdd(TRUSTED_MEMORY_AGENT_SESSION_RUNNERS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedMemoryAwareAgentSessionRunner(this)) {
      throw new TypeError('Memory-aware session requires an exact trusted runner');
    }
    requireDataObject(options, 'Memory-aware session options', MEMORY_AGENT_SESSION_RUN_KEYS);
    const {
      adoptionAuthority,
      agentGoal,
      architectureGoal,
      cases,
      context = {},
      ledger,
      plannerCandidates,
      productionBudget,
      query = {},
      reproduction = 'MemoryAwareAgentSessionRunner.run',
      researchBudget,
      skepticBudget
    } = options;
    if (adoptionAuthority !== undefined) {
      throw new TypeError('Memory-aware session adoptionAuthority is constructor-owned');
    }
    if (!isTrustedEvidenceLedger(ledger)) {
      throw new TypeError('Memory-aware session requires a trusted evidence ledger');
    }
    if (!isPlainObject(context)) {
      throw new TypeError('Memory-aware session context must be a plain object');
    }
    if (!isPlainObject(query)) {
      throw new TypeError('Memory-aware session query must be a plain object');
    }
    const normalizedArchitectureGoal = requireNonEmptyString(
      architectureGoal,
      'Memory-aware session architectureGoal'
    );
    const normalizedAgentGoal = requireNonEmptyString(
      agentGoal,
      'Memory-aware session agentGoal'
    );
    const normalizedContext = snapshotProcessData(context);
    const normalizedQuery = snapshotProcessData(query);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware session reproduction'
    );
    const discovery = this.discoveryRunner.discover({
      goal: normalizedArchitectureGoal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget
    });
    if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
      throw new TypeError('Memory-aware session discovery returned untrusted evidence');
    }
    if (
      discovery.complete !== true
      || discovery.adopted !== true
      || !isTrustedAgentArchitectureAdoption(
        discovery.adoption.adoption,
        this.discoveryRunner.adoptionAuthority
      )
    ) {
      throw new Error('Memory-aware session requires complete trusted adopted evidence');
    }
    const coordination = this.coordinationRunner.run({
      adoption: discovery.adoption.adoption,
      ledger,
      agentGoal: normalizedAgentGoal,
      query: normalizedQuery,
      context: normalizedContext,
      reproduction: normalizedReproduction
    });
    if (!isTrustedMemoryAwareAgentCoordinationReport(coordination)) {
      throw new TypeError('Memory-aware session coordination returned untrusted evidence');
    }
    return new MemoryAwareAgentSessionReport({
      runner: this,
      discoverySummary: discoverySummaryFor(discovery),
      coordination,
      architectureGoal: normalizedArchitectureGoal,
      agentGoal: normalizedAgentGoal,
      query: normalizedQuery,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      token: SESSION_TOKEN
    });
  }
}

export function isTrustedMemoryAwareAgentSessionRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SESSION_RUNNERS, runner)
    && isFrozenObject(runner)
    && objectGetPrototypeOf(runner) === MemoryAwareAgentSessionRunner.prototype;
}

objectFreeze(MemoryAwareAgentSessionReport.prototype);
objectFreeze(MemoryAwareAgentSessionRunner.prototype);
