import assert from 'node:assert/strict';

import { EvaluationCase } from '../src/evaluation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import { EvolutionAuthority, MUTATION_LEVELS } from '../src/evolution.mjs';

const cases = [new EvaluationCase({
  id: 'evolution-aggregation-isolation-case',
  domain: 'graph',
  task: {
    id: 'evolution-aggregation-isolation-task',
    description: 'Find a graph path'
  },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  adversarial: true,
  expected: (report) => report?.result?.path?.join('>') === 'A>B'
})];

const baseline = new RepresentationCandidate({
  id: 'evolution-aggregation-isolation-baseline',
  selectorFactory: () => new HeuristicRepresentationSelector()
});
const candidate = new RepresentationCandidate({
  id: 'evolution-aggregation-isolation-candidate',
  selectorFactory: () => new HeuristicRepresentationSelector()
});
const runner = new RepresentationSearchRunner();
const searchReport = runner.evaluate({ candidates: [baseline, candidate], cases });
const reproductionReport = runner.evaluate({ candidates: [baseline, candidate], cases });

const originalEvery = Array.prototype.every;
const originalSome = Array.prototype.some;
try {
  Array.prototype.every = () => true;
  Array.prototype.some = () => true;

  const authority = new EvolutionAuthority();
  const proposal = authority.propose({
    id: 'evolution-aggregation-isolation-proposal',
    level: MUTATION_LEVELS.PROMPTS,
    searchReport,
    reproductionReport,
    baselineCandidateId: baseline.id,
    candidateCandidateId: candidate.id
  });
  const approval = authority.approve(proposal);

  assert.equal(proposal.reproducible, true);
  assert.equal(proposal.improvement.nonRegressing, true);
  assert.equal(proposal.improvement.strictImprovement, false);
  assert.equal(proposal.improvement.demonstrated, false);
  assert.equal(approval.approved, false);
  assert.match(approval.reasons.join('|'), /strictly improve/);
} finally {
  Array.prototype.every = originalEvery;
  Array.prototype.some = originalSome;
}

console.log('FLUID_EVOLUTION_AGGREGATION_ISOLATION_OK');
