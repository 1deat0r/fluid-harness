import assert from 'node:assert/strict';

import {
  Constitution,
  ConstitutionalCore
} from '../src/constitution.mjs';
import {
  EvaluationBudget,
  EvaluationCase,
  PromotionAuthority,
  isTrustedPromotionAuthority
} from '../src/evaluation.mjs';
import { HeuristicRepresentationSelector } from '../src/representation.mjs';
import {
  RepresentationCandidate,
  RepresentationSearchRunner
} from '../src/search.mjs';

class ForgedAuthority extends PromotionAuthority {
  decide() {
    return {
      candidateId: 'forged-candidate',
      promoted: true,
      reasons: []
    };
  }
}

const forged = new ForgedAuthority();
assert.equal(forged instanceof PromotionAuthority, true);
assert.equal(isTrustedPromotionAuthority(new PromotionAuthority()), true);
assert.equal(isTrustedPromotionAuthority(forged), false);
assert.throws(
  () => new ConstitutionalCore({
    constitution: new Constitution({ maxAuditEntries: 16 }),
    promotionAuthority: forged
  }),
  /trusted PromotionAuthority/
);

const proxied = new Proxy(new PromotionAuthority(), {
  get(target, property, receiver) {
    if (property === 'decide') {
      return () => ({ candidateId: 'forged-proxy', promoted: true, reasons: [] });
    }
    return Reflect.get(target, property, receiver);
  }
});
assert.equal(isTrustedPromotionAuthority(proxied), false);
assert.throws(
  () => new ConstitutionalCore({ promotionAuthority: proxied }),
  /trusted PromotionAuthority/
);

const report = new RepresentationSearchRunner({
  promotionAuthorityFactory: () => forged
}).evaluate({
  candidates: [new RepresentationCandidate({
    id: 'promotion-authority-subclass-candidate',
    selectorFactory: () => new HeuristicRepresentationSelector()
  })],
  cases: [new EvaluationCase({
    id: 'promotion-authority-subclass-case',
    domain: 'graph',
    task: {
      id: 'promotion-authority-subclass-task',
      description: 'Find a graph path'
    },
    input: {
      nodes: ['A', 'B'],
      edges: [['A', 'B']],
      start: 'A',
      goal: 'B'
    },
    expected: (value) => value?.result?.path?.join('>') === 'A>B'
  })],
  productionBudget: new EvaluationBudget({ maxCases: 1 }),
  researchBudget: new EvaluationBudget({ maxCases: 1 }),
  skepticBudget: new EvaluationBudget({ maxCases: 1 })
});
assert.match(report.results[0].error, /trusted PromotionAuthority/);

console.log('FLUID_PROMOTION_AUTHORITY_SUBCLASS_BOUNDARY_OK');
