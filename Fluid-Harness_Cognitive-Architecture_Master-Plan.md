# Fluid-Harness: Cognitive Architecture Research Plan

## Core Thesis

Fluid should not be designed around one supposedly ideal cognitive architecture.

It should be designed around the ability to **discover better cognitive architectures under rigorous external evaluation**.

The strongest form of Fluid is therefore not simply:

- LLM → Python
- LLM → TypeScript
- LLM → Fluid IR
- LLM → adaptive routing

It is a system that can choose its own problem representation, reasoning mechanism, execution substrate, verification method, and eventually propose and test alternative internal architectures.

---

## 1. Choose the Representation Before the Tool

A major limitation of most agent harnesses is that they assume the problem is already represented correctly.

Fluid should first ask:

> What mathematical or computational object is this problem?

A task might be better represented as:

- a graph
- a constraint system
- a program synthesis problem
- probabilistic inference
- a search tree
- an optimization problem
- a simulation
- a theorem
- a database query
- an ordinary-language reasoning task

Examples:

```text
Dependency problem
→ graph

Scheduling problem
→ constraint solver

Numerical problem
→ array computation

API orchestration
→ TypeScript

Symbolic invariant
→ theorem prover

Repository search
→ indexed graph traversal

Ambiguous product requirement
→ LLM semantic reasoning
```

The deeper question is therefore not:

> Should this use Python or TypeScript?

It is:

> What representation makes this problem easiest to solve correctly?

---

## 2. Add a Structured World Model

Fluid should maintain a structured predictive model of its environment:

\[
P(s_{t+1}\mid s_t,a_t)
\]

Before an important action, Fluid predicts what should happen.

Then it executes and compares the prediction with reality.

Example:

```text
Predicted:
tests pass with probability .83

Observed:
tests fail

Surprise:
high

Likely implication:
world model is missing a dependency or assumption
```

Prediction error becomes a learning signal.

---

## 3. Make Surprise a First-Class Signal

Define surprise approximately as:

\[
Surprise=-\log P(observation)
\]

High surprise means:

> My current model of the situation is probably wrong.

High-surprise events should trigger investigation rather than blind continuation.

This gives Fluid a computational version of scientific curiosity.

---

## 4. Search Over Representations, Not Just Parameters

Fluid should eventually be able to propose new internal abstractions.

Suppose its evidence system struggles with debugging.

Instead of merely changing thresholds, a descendant might propose:

```text
Current:

Claim
→ Evidence

Alternative:

Hypothesis
→ predicted observations
→ experiments
→ observations
→ causal graph
```

Both architectures can then be tested experimentally.

This means Fluid is no longer just optimizing parameters inside a fixed architecture.

It is searching the space of cognitive architectures.

---

## 5. Self-Modification Hierarchy

Fluid's mutation privilege ladder can eventually become:

```text
Level 1   Parameters
Level 2   Prompts
Level 3   Policies
Level 4   Workflows
Level 5   Modules
Level 6   Architectures
Level 7   Internal representations
Level 8   Search/evolution algorithms
Level 9   Methods for inventing representations
```

Each level should unlock only after lower-level improvement has been demonstrated reproducibly.

---

## 6. Multiple Reasoning Engines

Fluid should not assume the LLM remains the best reasoning engine for every problem.

Candidate reasoning systems should include:

```text
LLM
program synthesis
SAT/SMT solver
constraint solver
theorem prover
Bayesian inference
Monte Carlo search
graph algorithms
symbolic algebra
numerical optimization
evolutionary search
learned policies
```

Hybrid reasoning should be normal.

Example:

```text
LLM understands requirement
 ↓
LLM formalizes constraints
 ↓
SMT solver finds valid configuration
 ↓
TypeScript executes it
 ↓
property tests verify it
```

The key principle:

> Do not make a probabilistic model solve a deterministic problem once the problem has been formalized enough for a deterministic method.

---

## 7. Separate Exploration From Exploitation

Fluid should conceptually maintain two policies.

### Production Policy

> What is the best-known way to solve this task safely and efficiently?

### Research Policy

> What should I try because I am uncertain and want to learn?

The production policy protects real work.

The research policy receives a fixed experimental budget and explores:

```text
unknown regions
poor calibration
high failure rates
contradictory evidence
high surprise
architectural bottlenecks
underexplored strategies
```

Discoveries move into production only after external evaluation.

---

## 8. Make Transfer a First-Class Metric

An improvement is more interesting if it transfers across environments.

Evaluate changes across:

```text
React repositories
Rust repositories
Python ML projects
large monorepos
unfamiliar frameworks
new model generations
different operating systems
different providers
```

Maintain a transfer matrix:

\[
T_{ij}
=
\text{gain from improvement i on domain j}
\]

Classify discoveries as:

```text
local trick
domain-specific skill
general architectural improvement
```

General architectural improvements receive the highest evolutionary value.

---

## 9. Measure Scaling Curves, Not One Benchmark Point

For every architecture estimate:

\[
Performance=f(Compute)
\]

A strategy may dominate at one budget and lose at another.

Example:

```text
Architecture A
best at $0.10/task

Architecture B
best at $1/task

Architecture C
only wins at $20/task
```

Track:

```text
success vs tokens
success vs wall time
success vs model strength
success vs parallel workers
success vs context size
```

Fluid should optimize the Pareto frontier rather than one score.

---

## 10. Maintain Adversarial Descendants

Some evolutionary branches should exist specifically to attack Fluid's epistemology.

Their objective is to discover:

```text
false assumptions
overconfident claims
benchmark shortcuts
evaluation leakage
fragile heuristics
correlated verifier failures
misleading cost accounting
distribution-shift failures
```

Possible evolutionary lineages:

```text
Builder lineage
Research lineage
Efficiency lineage
Robustness lineage
Skeptic lineage
```

The skeptic lineage is not promoted into production.

Its fitness is:

> How many genuine weaknesses in Fluid can you expose?

This gives Fluid an endogenous red team.

---

## 11. Proof-Carrying Actions

Important operations should return more than:

```text
done
```

They should increasingly return:

```text
result
+
evidence
+
invariants checked
+
environment hash
+
reproduction procedure
```

Fluid should distinguish:

```text
BELIEVED
supported primarily by model reasoning

OBSERVED
supported by experiment

PROVEN
supported by deterministic or formal verification
```

Prefer moving claims upward:

```text
BELIEVED
   ↓
OBSERVED
   ↓
PROVEN
```

whenever the expected value justifies the verification cost.

---

## 12. Constitutional Minimal Core

Fluid should have a very small trusted computing base that cannot self-modify.

Candidate immutable components:

```text
resource enforcement
sandbox boundary
evaluation separation
cryptographic audit log
promotion authority
human shutdown/override
```

Everything above this boundary may eventually evolve.

The smaller the immutable core, the larger the meaningful search space for self-improvement while preserving external control.

---

## 13. Fluid's Full Cognitive Cycle

The mature system should behave approximately like:

```text
Understand the goal.
Choose the representation.
Choose the reasoning system.
Choose the execution substrate.
Predict what should happen.
Act.
Measure what happened.
Measure surprise.
Update beliefs.
Verify.
Learn which strategy worked.
Question the strategy.
Question the representation.
Question the architecture.
Experiment on alternatives.
Preserve only reproducible gains.
Repeat.
```

---

## 14. The Point Where Human Design Should Stop

The goal should not be to manually specify every sophisticated mechanism Fluid might ever need.

At some point the project should deliberately transition from:

> humans invent better Fluid architectures

to:

> Fluid runs better architecture experiments than humans can manually design.

Continuing to hard-code human architectural preferences beyond that point would undermine the central thesis.

---

# Final Design Principle

Fluid should not be built around one ideal cognitive architecture.

It should be built around **the ability to discover better cognitive architectures under rigorous external evaluation**.

That is a substantially stronger objective than simply creating:

```text
Prime Agent
+
TypeScript
+
Rust
+
adaptive routing
```

The long-term target is a system capable of asking not only:

> How should I solve this task?

but eventually:

> What kind of reasoning system should exist to solve tasks like this at all?
