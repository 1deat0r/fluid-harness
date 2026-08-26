import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  AgentArchitectureCandidate,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureReproducibilityReport,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureSearchReport
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

function evaluationCase(id) {
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
    expected: (report) => report?.completed === true
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
  'architecture-repro-boundary-direct',
  planner('architecture-repro-boundary-direct')
);
const primaryCase = evaluationCase('architecture-repro-boundary-primary');
const primary = evaluate(new AgentArchitectureSearchRunner(), direct, [primaryCase]);
const reproduction = evaluate(new AgentArchitectureSearchRunner(), direct, [primaryCase]);
const authority = new AgentArchitectureReproducibilityAuthority();
const validEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: reproduction,
  candidateId: direct.id
});
assert.equal(validEvidence.reproducible, true);

const sameRunner = new AgentArchitectureSearchRunner();
const sameRunnerPrimary = evaluate(sameRunner, direct, [primaryCase]);
const sameRunnerReplay = evaluate(sameRunner, direct, [primaryCase]);
const sameRunnerEvidence = authority.reproduce({
  searchReport: sameRunnerPrimary,
  reproductionReport: sameRunnerReplay,
  candidateId: direct.id
});
assert.equal(sameRunnerEvidence.reproducible, false);
assert.match(sameRunnerEvidence.reasons.join(';'), /independent|contract/);

const alteredBudget = evaluate(
  new AgentArchitectureSearchRunner(),
  direct,
  [primaryCase],
  2
);
const alteredBudgetEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: alteredBudget,
  candidateId: direct.id
});
assert.equal(alteredBudgetEvidence.reproducible, false);
assert.match(alteredBudgetEvidence.reasons.join(';'), /budget/);

const changedSuiteCase = evaluationCase('architecture-repro-boundary-primary');
const changedSuite = evaluate(
  new AgentArchitectureSearchRunner(),
  direct,
  [changedSuiteCase]
);
const changedSuiteEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: changedSuite,
  candidateId: direct.id
});
assert.equal(changedSuiteEvidence.reproducible, false);
assert.match(changedSuiteEvidence.reasons.join(';'), /suite|contract/);

const changedDefinition = architecture(
  direct.id,
  planner('architecture-repro-boundary-direct', 'planMissingDescription')
);
const changedDefinitionReport = evaluate(
  new AgentArchitectureSearchRunner(),
  changedDefinition,
  [primaryCase]
);
const changedDefinitionEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: changedDefinitionReport,
  candidateId: direct.id
});
assert.equal(changedDefinitionEvidence.reproducible, false);
assert.match(changedDefinitionEvidence.reasons.join(';'), /candidate|definition|evidence/);

const incompleteCases = [
  primaryCase,
  evaluationCase('architecture-repro-boundary-second')
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
assert.equal(incompletePrimary.complete, false);
assert.equal(incompleteReproduction.complete, false);
const incompleteEvidence = authority.reproduce({
  searchReport: incompletePrimary,
  reproductionReport: incompleteReproduction,
  candidateId: direct.id
});
assert.equal(incompleteEvidence.reproducible, false);
assert.match(incompleteEvidence.reasons.join(';'), /complete/);

const sameReportEvidence = authority.reproduce({
  searchReport: primary,
  reproductionReport: primary,
  candidateId: direct.id
});
assert.equal(sameReportEvidence.reproducible, false);

const forgedReport = Object.create(Object.getPrototypeOf(primary));
assert.equal(isTrustedAgentArchitectureSearchReport(forgedReport), false);
assert.throws(
  () => authority.reproduce({
    searchReport: forgedReport,
    reproductionReport: reproduction,
    candidateId: direct.id
  }),
  /trusted search reports/
);
assert.throws(
  () => Object.create(Object.getPrototypeOf(authority)).reproduce({
    searchReport: primary,
    reproductionReport: reproduction,
    candidateId: direct.id
  }),
  /exact trusted authority/
);
assert.throws(
  () => new AgentArchitectureReproducibilityReport({
    candidateId: direct.id,
    primary,
    reproduction,
    reproducible: true,
    reasons: []
  }),
  /trusted authority path/
);

assert.equal(primary.promoted, null);
assert.equal(reproduction.promoted, null);
assert.equal('promoted' in primary.results[0], false);
assert.equal('promoted' in validEvidence, false);

console.log(
  `FLUID_AGENT_ARCHITECTURE_REPRODUCIBILITY_BOUNDARY_OK `
  + `sameRunnerRejected=${!sameRunnerEvidence.reproducible} `
  + `budgetRejected=${!alteredBudgetEvidence.reproducible} `
  + `suiteRejected=${!changedSuiteEvidence.reproducible} `
  + `definitionRejected=${!changedDefinitionEvidence.reproducible} `
  + `incompleteRejected=${!incompleteEvidence.reproducible} `
  + `forgedRejected=true noPromotion=true`
);
