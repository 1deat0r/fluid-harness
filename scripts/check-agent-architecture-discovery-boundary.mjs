import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureSearchRunner
} from '../src/agent-architecture.mjs';
import {
  AgentArchitectureDiscoveryRunner,
  isTrustedAgentArchitectureDiscoveryReport
} from '../src/agent-architecture-discovery.mjs';
import { AgentArchitectureProposalRunner } from '../src/agent-architecture-proposal.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function proposalRunner(exportName, maxProposals = 2) {
  return new AgentArchitectureProposalRunner({
    runner: new ProcessIsolatedRunner({
      modulePath: fixturePath,
      exportName,
      timeoutMs: 2000
    }),
    maxProposals
  });
}

function plannerCandidate(id) {
  return new AgentPlannerCandidate({
    id,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName: 'planGraphDirect',
        timeoutMs: 2000
      }),
      plannerId: `${id}-runtime`
    })
  });
}

function evaluationCase(id, expected = (report) => report?.completed === true) {
  return new AgentPlannerCase({
    id,
    domain: 'graph',
    goal: 'graph',
    context: {
      taskId: `${id}-task`,
      description: 'Find a graph path'
    },
    task: {
      id: `${id}-task`,
      description: 'Find a graph path'
    },
    adversarial: true,
    expected
  });
}

function discover(runner, candidate, cases) {
  return runner.discover({
    goal: 'discover and safely adopt a bounded graph architecture',
    plannerCandidates: [candidate],
    cases,
    productionBudget: new EvaluationBudget({ maxCases: cases.length }),
    researchBudget: new EvaluationBudget({ maxCases: cases.length }),
    skepticBudget: new EvaluationBudget({ maxCases: cases.length })
  });
}

const candidate = plannerCandidate('architecture-discovery-boundary-registered-planner');
const directRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: proposalRunner('proposeArchitectureDirect')
});
const directCase = evaluationCase('architecture-discovery-boundary-direct-case');
const validReport = discover(directRunner, candidate, [directCase]);
assert.equal(isTrustedAgentArchitectureDiscoveryReport(validReport), true);
assert.equal(validReport.adopted, true);
assert.equal(validReport.deployed, false);

const unknownRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: proposalRunner('proposeArchitectureUnknown')
});
assert.throws(
  () => discover(unknownRunner, candidate, [directCase]),
  /unknown planner candidate/
);

const malformedRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: proposalRunner('proposeArchitectureMalformed')
});
assert.throws(
  () => discover(malformedRunner, candidate, [directCase]),
  /safe integer|AgentPolicy|episodes/
);

const oversizedRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: proposalRunner('proposeArchitectureMany', 2)
});
assert.throws(
  () => discover(oversizedRunner, candidate, [directCase]),
  /maximum is 2/
);

const weakRunner = new AgentArchitectureDiscoveryRunner({
  proposalRunner: proposalRunner('proposeArchitectureDirect'),
  adoptionAuthority: new AgentArchitectureAdoptionAuthority()
});
const weakReport = discover(
  weakRunner,
  plannerCandidate('architecture-discovery-boundary-weak-planner'),
  [evaluationCase('architecture-discovery-boundary-weak-case', () => false)]
);
assert.equal(weakReport.complete, true);
assert.equal(weakReport.reproducibility.reproducible, true);
assert.equal(weakReport.adopted, false);
assert.match(weakReport.adoption.reasons.join(';'), /threshold/);

assert.throws(
  () => new AgentArchitectureDiscoveryRunner({
    proposalRunner: Object.create(Object.getPrototypeOf(directRunner.proposalRunner))
  }),
  /trusted proposal runner/
);
assert.throws(
  () => new AgentArchitectureDiscoveryRunner({
    proposalRunner: directRunner.proposalRunner,
    adoptionAuthority: Object.create(Object.getPrototypeOf(directRunner.adoptionAuthority))
  }),
  /trusted adoption authority/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(directRunner)).discover({
    goal: 'forged',
    plannerCandidates: [candidate],
    cases: [directCase]
  }),
  /exact trusted runner/
);
assert.throws(
  () => directRunner.discover({
    goal: 'invalid cases',
    plannerCandidates: [candidate],
    cases: [Object.create(Object.getPrototypeOf(directCase))]
  }),
  /trusted AgentPlannerCase/
);
assert.throws(
  () => directRunner.discover({
    goal: 'invalid budget',
    plannerCandidates: [candidate],
    cases: [directCase],
    productionBudget: { maxCases: 1 }
  }),
  /trusted EvaluationBudget/
);

const forgedReport = Object.create(Object.getPrototypeOf(validReport));
assert.equal(isTrustedAgentArchitectureDiscoveryReport(forgedReport), false);
assert.equal(validReport.primary.promoted, null);
assert.equal(validReport.reproduction.promoted, null);
assert.equal('promoted' in validReport, false);
assert.equal('deployment' in validReport, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_DISCOVERY_BOUNDARY_OK `
  + `unknownRejected=true malformedRejected=true oversizedRejected=true `
  + `thresholdRejected=${!weakReport.adopted} forgedRunnerRejected=true `
  + `invalidInputRejected=true deployment=false promotion=false`
);
