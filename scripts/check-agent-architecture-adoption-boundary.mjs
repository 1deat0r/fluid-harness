import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureAdoption,
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  architectureFromAdoptedSearch
} from '../src/agent-architecture.mjs';
import { AgentPlannerCandidate, AgentPlannerCase } from '../src/agent-search.mjs';
import { EvaluationBudget } from '../src/evaluation.mjs';
import { AgentPolicy } from '../src/evolution.mjs';
import { ProcessBackedAgentPlanner } from '../src/agent-plan.mjs';
import { ProcessIsolatedRunner } from '../src/process-boundary.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/process-boundary-candidate.mjs', import.meta.url));

function planner(id, exportName = 'planGraphDirect') {
  return new AgentPlannerCandidate({
    id: `${id}-planner-candidate`,
    plannerFactory: () => new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName,
        timeoutMs: 2000
      }),
      plannerId: `${id}-planner`
    })
  });
}

function architecture(id, plannerCandidate) {
  return new AgentArchitectureCandidate({
    id,
    plannerCandidate,
    policyFactory: () => new AgentPolicy({
      maxEpisodes: 2,
      maxToolCallsPerEpisode: 2
    }),
    components: {
      planner: 'registered-process-planner',
      policy: 'bounded-v1',
      verifier: 'parent-core'
    }
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

function budget(maxCases) {
  return new EvaluationBudget({ maxCases });
}

function evaluate(searchRunner, candidate, cases, maxCases = cases.length) {
  return searchRunner.evaluate({
    candidates: [candidate],
    cases,
    productionBudget: budget(maxCases),
    researchBudget: budget(maxCases),
    skepticBudget: budget(maxCases)
  });
}

const direct = architecture(
  'architecture-adoption-boundary-direct',
  planner('architecture-adoption-boundary-direct')
);
const directCase = evaluationCase('architecture-adoption-boundary-direct-case');
const primary = evaluate(new AgentArchitectureSearchRunner(), direct, [directCase]);
const reproduction = evaluate(new AgentArchitectureSearchRunner(), direct, [directCase]);
const reproducibilityAuthority = new AgentArchitectureReproducibilityAuthority();
const reproducibility = reproducibilityAuthority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: direct.id
});
assert.equal(reproducibility.reproducible, true);

const adoptionAuthority = new AgentArchitectureAdoptionAuthority();
const validDecision = adoptionAuthority.adopt(reproducibility);
assert.equal(validDecision.adopted, true);
assert.equal(validDecision.adoption.deployed, false);

const sameReportEvidence = reproducibilityAuthority.reproduce({
  searchReport: primary,
  reproductionReport: primary,
  candidateId: direct.id
});
assert.equal(sameReportEvidence.reproducible, false);
const sameReportDecision = adoptionAuthority.adopt(sameReportEvidence);
assert.equal(sameReportDecision.adopted, false);
assert.match(sameReportDecision.reasons.join(';'), /reproducibility|independent/);

const incompleteCases = [
  directCase,
  evaluationCase('architecture-adoption-boundary-incomplete-case')
];
const incompletePrimary = evaluate(
  new AgentArchitectureSearchRunner(),
  direct,
  incompleteCases,
  1
);
const incompleteReproduction = evaluate(
  new AgentArchitectureSearchRunner(),
  direct,
  incompleteCases,
  1
);
const incompleteEvidence = reproducibilityAuthority.reproduce({
  searchReport: incompletePrimary,
  reproductionReport: incompleteReproduction,
  candidateId: direct.id
});
assert.equal(incompleteEvidence.reproducible, false);
const incompleteDecision = adoptionAuthority.adopt(incompleteEvidence);
assert.equal(incompleteDecision.adopted, false);
assert.match(incompleteDecision.reasons.join(';'), /complete/);

const weakCandidate = architecture(
  'architecture-adoption-boundary-weak',
  planner('architecture-adoption-boundary-weak')
);
const weakCase = evaluationCase(
  'architecture-adoption-boundary-weak-case',
  () => false
);
const weakPrimary = evaluate(new AgentArchitectureSearchRunner(), weakCandidate, [weakCase]);
const weakReproduction = evaluate(new AgentArchitectureSearchRunner(), weakCandidate, [weakCase]);
const weakEvidence = reproducibilityAuthority.reproduce({
  searchReport: weakPrimary,
  reproductionReport: weakReproduction,
  candidateId: weakCandidate.id
});
assert.equal(weakEvidence.reproducible, true);
const weakDecision = adoptionAuthority.adopt(weakEvidence);
assert.equal(weakDecision.adopted, false);
assert.match(weakDecision.reasons.join(';'), /threshold/);

let driftingPlannerCalls = 0;
const driftingPlanner = new AgentPlannerCandidate({
  id: 'architecture-adoption-boundary-drifting-planner-candidate',
  plannerFactory: () => {
    const exportName = driftingPlannerCalls < 6
      ? 'planGraphDirect'
      : 'planMissingDescription';
    driftingPlannerCalls += 1;
    return new ProcessBackedAgentPlanner({
      runner: new ProcessIsolatedRunner({
        modulePath: fixturePath,
        exportName,
        timeoutMs: 2000
      }),
      plannerId: 'architecture-adoption-boundary-drifting-planner'
    });
  }
});
const driftingCandidate = architecture(
  'architecture-adoption-boundary-drifting',
  driftingPlanner
);
const driftingPrimary = evaluate(
  new AgentArchitectureSearchRunner(),
  driftingCandidate,
  [directCase]
);
const driftingReproduction = evaluate(
  new AgentArchitectureSearchRunner(),
  driftingCandidate,
  [directCase]
);
const driftingEvidence = reproducibilityAuthority.reproduce({
  searchReport: driftingPrimary,
  reproductionReport: driftingReproduction,
  candidateId: driftingCandidate.id
});
assert.equal(driftingEvidence.reproducible, true);
const driftingDecision = adoptionAuthority.adopt(driftingEvidence);
assert.equal(driftingDecision.adopted, false);
assert.match(driftingDecision.reasons.join(';'), /planner definition changed/);

const forgedEvidence = Object.create(Object.getPrototypeOf(reproducibility));
assert.throws(
  () => adoptionAuthority.adopt(forgedEvidence),
  /trusted reproducibility report/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(adoptionAuthority)).adopt(reproducibility),
  /exact trusted authority/
);
assert.throws(
  () => new AgentArchitectureAdoption({
    reproducibility,
    candidate: direct
  }),
  /trusted replay evidence/
);
assert.throws(
  () => architectureFromAdoptedSearch(Object.create(Object.getPrototypeOf(validDecision.adoption))),
  /trusted adoption evidence/
);

assert.equal(primary.promoted, null);
assert.equal(reproduction.promoted, null);
assert.equal('promoted' in validDecision.adoption, false);
assert.equal('deployment' in validDecision.adoption, false);
assert.equal('constitutionalCore' in validDecision.adoption, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_ADOPTION_BOUNDARY_OK `
  + `invalidEvidenceRejected=${!sameReportDecision.adopted} `
  + `incompleteRejected=${!incompleteDecision.adopted} `
  + `thresholdRejected=${!weakDecision.adopted} `
  + `definitionDriftRejected=${!driftingDecision.adopted} `
  + `forgedRejected=true deployed=false constitutionalMutation=false`
);
