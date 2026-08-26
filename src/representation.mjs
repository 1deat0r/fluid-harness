import {
  arrayFilter,
  arrayMap,
  arrayReduce,
  arraySlice,
  arraySort,
  isFiniteNumber,
  isInstanceOf,
  minNumbers,
  regexpCreate,
  stringLocaleCompare,
  stringReplace,
  stringToLowerCase,
  stringTrim,
  objectFreeze,
  objectGetPrototypeOf,
  regexpTest,
  toBoolean,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const REPRESENTATIONS = objectFreeze({
  NATURAL_LANGUAGE: 'natural-language',
  GRAPH: 'graph',
  CONSTRAINT_SYSTEM: 'constraint-system',
  PROGRAM_SYNTHESIS: 'program-synthesis',
  PROBABILISTIC_INFERENCE: 'probabilistic-inference',
  SEARCH_TREE: 'search-tree',
  OPTIMIZATION: 'optimization',
  SIMULATION: 'simulation',
  THEOREM: 'theorem',
  DATABASE_QUERY: 'database-query',
  ARRAY_COMPUTATION: 'array-computation'
});

export const REASONING_ENGINES = objectFreeze({
  LANGUAGE_MODEL: 'language-model',
  GRAPH_ALGORITHMS: 'graph-algorithms',
  CONSTRAINT_SOLVER: 'constraint-solver',
  PROGRAM_SYNTHESIS: 'program-synthesis',
  BAYESIAN_INFERENCE: 'bayesian-inference',
  MONTE_CARLO_SEARCH: 'monte-carlo-search',
  NUMERICAL_OPTIMIZER: 'numerical-optimizer',
  SIMULATION_ENGINE: 'simulation-engine',
  THEOREM_PROVER: 'theorem-prover',
  QUERY_PLANNER: 'query-planner',
  ARRAY_COMPUTER: 'array-computer'
});

export const EXECUTION_SUBSTRATES = objectFreeze({
  MODEL_PROVIDER: 'model-provider',
  DETERMINISTIC_KERNEL: 'deterministic-kernel',
  TYPESCRIPT_RUNTIME: 'typescript-runtime',
  RESEARCH_WORKER: 'research-worker'
});

const KEYWORD_RULES = [
  {
    representation: REPRESENTATIONS.GRAPH,
    keywords: [
      ['dependency', 2],
      ['graph', 3],
      ['network', 2],
      ['shortest path', 3],
      ['topological', 3],
      ['node graph', 3],
      ['edge graph', 3],
      ['nodes and edges', 3]
    ]
  },
  {
    representation: REPRESENTATIONS.CONSTRAINT_SYSTEM,
    keywords: [
      ['constraint', 3],
      ['schedule', 2],
      ['allocation', 2],
      ['resource', 1],
      ['deadline', 2],
      ['satisfy', 1]
    ]
  },
  {
    representation: REPRESENTATIONS.PROGRAM_SYNTHESIS,
    keywords: [
      ['implement', 2],
      ['function', 2],
      ['code', 1],
      ['refactor', 2],
      ['bug', 1],
      ['repository', 2],
      ['api', 2],
      ['node.js', 2]
    ]
  },
  {
    representation: REPRESENTATIONS.PROBABILISTIC_INFERENCE,
    keywords: [
      ['probability', 3],
      ['bayesian', 3],
      ['posterior', 3],
      ['likelihood', 2],
      ['uncertain', 1]
    ]
  },
  {
    representation: REPRESENTATIONS.SEARCH_TREE,
    keywords: [
      ['search tree', 3],
      ['candidate', 1],
      ['branch', 1],
      ['explore', 1]
    ]
  },
  {
    representation: REPRESENTATIONS.OPTIMIZATION,
    keywords: [
      ['optimize', 3],
      ['minimize', 3],
      ['maximize', 3],
      ['objective', 2],
      ['cost', 1]
    ]
  },
  {
    representation: REPRESENTATIONS.SIMULATION,
    keywords: [
      ['simulate', 3],
      ['simulation', 3],
      ['scenario', 2],
      ['forecast', 2]
    ]
  },
  {
    representation: REPRESENTATIONS.THEOREM,
    keywords: [
      ['prove', 3],
      ['theorem', 3],
      ['invariant', 3],
      ['formal', 2]
    ]
  },
  {
    representation: REPRESENTATIONS.DATABASE_QUERY,
    keywords: [
      ['sql', 3],
      ['database', 3],
      ['query', 2],
      ['records', 1]
    ]
  },
  {
    representation: REPRESENTATIONS.ARRAY_COMPUTATION,
    keywords: [
      ['matrix', 3],
      ['array', 3],
      ['numeric', 2],
      ['vector', 2]
    ]
  }
];

const TRUSTED_TASKS = weakSetCreate();

function keywordPattern(keyword) {
  const escaped = stringReplace(
    stringReplace(keyword, /[.*+?^${}()|[\]\\]/g, '\\$&'),
    /\s+/g,
    '\\s+'
  );
  return regexpCreate(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
}

function rankRepresentations(description) {
  const ranked = arrayMap(KEYWORD_RULES, ({ representation, keywords }) => {
    const matches = arrayFilter(
      arrayMap(keywords, ([keyword, weight]) => ({
        keyword,
        weight,
        pattern: keywordPattern(keyword)
      })),
      ({ pattern }) => regexpTest(pattern, description)
    );

    return {
      representation,
      score: arrayReduce(matches, (total, { weight }) => total + weight, 0),
      matches: arrayMap(matches, ({ keyword }) => keyword)
    };
  });

  return arraySort(
    arrayFilter(ranked, ({ score }) => score > 0),
    (left, right) => right.score - left.score || stringLocaleCompare(left.representation, right.representation)
  );
}

export class Task {
  constructor({ id, description }) {
    if (typeof id !== 'string' || stringTrim(id) === '') {
      throw new TypeError('Task id must be a non-empty string');
    }

    if (typeof description !== 'string' || stringTrim(description) === '') {
      throw new TypeError('Task description must be a non-empty string');
    }

    this.id = stringTrim(id);
    this.description = stringTrim(description);
    weakSetAdd(TRUSTED_TASKS, this);
    objectFreeze(this);
  }
}

export function isTrustedTask(task) {
  return typeof task === 'object'
    && task !== null
    && weakSetHas(TRUSTED_TASKS, task)
    && objectGetPrototypeOf(task) === Task.prototype;
}

export class RepresentationSelection {
  constructor({ representation, confidence, ambiguous, candidates }) {
    if (!representation || !isFiniteNumber(confidence) || confidence < 0 || confidence > 1) {
      throw new TypeError('RepresentationSelection requires a valid representation and confidence');
    }

    this.representation = representation;
    this.confidence = confidence;
    this.ambiguous = toBoolean(ambiguous);
    this.candidates = objectFreeze(arrayMap(candidates, (candidate) => objectFreeze({
      representation: candidate.representation,
      score: candidate.score,
      matches: objectFreeze(arraySlice(candidate.matches))
    })));
    objectFreeze(this);
  }
}

export class HeuristicRepresentationSelector {
  select(task) {
    if (!isTrustedTask(task)) {
      throw new TypeError('Representation selection requires a Task');
    }

    const candidates = rankRepresentations(stringToLowerCase(task.description));
    const top = candidates[0];
    const runnerUp = candidates[1];

    if (!top) {
      return new RepresentationSelection({
        representation: REPRESENTATIONS.NATURAL_LANGUAGE,
        confidence: 0,
        ambiguous: false,
        candidates: []
      });
    }

    const ambiguous = toBoolean(runnerUp && runnerUp.score === top.score);
    return new RepresentationSelection({
      representation: ambiguous ? REPRESENTATIONS.NATURAL_LANGUAGE : top.representation,
        confidence: ambiguous ? 0.25 : minNumbers([1, top.score / 6]),
      ambiguous,
      candidates
    });
  }
}

objectFreeze(HeuristicRepresentationSelector.prototype);

function normalizeSelection(selection) {
  if (isInstanceOf(selection, RepresentationSelection)) {
    return new RepresentationSelection({
      representation: selection.representation,
      confidence: selection.confidence,
      ambiguous: selection.ambiguous,
      candidates: selection.candidates
    });
  }

  if (typeof selection === 'string') {
    return new RepresentationSelection({
      representation: selection,
      confidence: 0,
      ambiguous: false,
      candidates: []
    });
  }

  throw new TypeError('Representation selector must return a RepresentationSelection');
}

export function reasoningEngineFor(representation) {
  const mapping = {
    [REPRESENTATIONS.GRAPH]: REASONING_ENGINES.GRAPH_ALGORITHMS,
    [REPRESENTATIONS.CONSTRAINT_SYSTEM]: REASONING_ENGINES.CONSTRAINT_SOLVER,
    [REPRESENTATIONS.PROGRAM_SYNTHESIS]: REASONING_ENGINES.PROGRAM_SYNTHESIS,
    [REPRESENTATIONS.PROBABILISTIC_INFERENCE]: REASONING_ENGINES.BAYESIAN_INFERENCE,
    [REPRESENTATIONS.SEARCH_TREE]: REASONING_ENGINES.MONTE_CARLO_SEARCH,
    [REPRESENTATIONS.OPTIMIZATION]: REASONING_ENGINES.NUMERICAL_OPTIMIZER,
    [REPRESENTATIONS.SIMULATION]: REASONING_ENGINES.SIMULATION_ENGINE,
    [REPRESENTATIONS.THEOREM]: REASONING_ENGINES.THEOREM_PROVER,
    [REPRESENTATIONS.DATABASE_QUERY]: REASONING_ENGINES.QUERY_PLANNER,
    [REPRESENTATIONS.ARRAY_COMPUTATION]: REASONING_ENGINES.ARRAY_COMPUTER,
    [REPRESENTATIONS.NATURAL_LANGUAGE]: REASONING_ENGINES.LANGUAGE_MODEL
  };

  return mapping[representation] ?? REASONING_ENGINES.LANGUAGE_MODEL;
}

export function executionSubstrateFor(reasoningEngine) {
  if (reasoningEngine === REASONING_ENGINES.LANGUAGE_MODEL) {
    return EXECUTION_SUBSTRATES.MODEL_PROVIDER;
  }

  if (reasoningEngine === REASONING_ENGINES.PROGRAM_SYNTHESIS) {
    return EXECUTION_SUBSTRATES.TYPESCRIPT_RUNTIME;
  }

  if (
    reasoningEngine === REASONING_ENGINES.MONTE_CARLO_SEARCH
  ) {
    return EXECUTION_SUBSTRATES.RESEARCH_WORKER;
  }

  return EXECUTION_SUBSTRATES.DETERMINISTIC_KERNEL;
}

export class Strategy {
  constructor({ representation, reasoningEngine, executionSubstrate, selection }) {
    this.representation = representation;
    this.reasoningEngine = reasoningEngine;
    this.executionSubstrate = executionSubstrate;
    this.selection = selection;
    this.selectionConfidence = selection?.confidence ?? 0;
    this.selectionAmbiguous = selection?.ambiguous ?? false;
    objectFreeze(this);
  }
}

export function strategyFor(task, selector = new HeuristicRepresentationSelector()) {
  const selection = normalizeSelection(selector.select(task));
  const representation = selection.representation;
  const reasoningEngine = reasoningEngineFor(representation);
  const executionSubstrate = executionSubstrateFor(reasoningEngine);

  return new Strategy({ representation, reasoningEngine, executionSubstrate, selection });
}
