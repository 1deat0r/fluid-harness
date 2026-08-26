# Fluid Harness

<!-- FLUID_HARNESS_PUBLIC_STATUS:START -->
## Public status

- Package version: 0.1.0
- Acceptance ledger: 463/463 gates marked met in [GATES.md](GATES.md).
- Scope: bounded architecture discovery, evaluation, archival, research, and improvement; no automatic deployment or artificial-superintelligence claim.
- Generated detail: [docs/STATUS.md](docs/STATUS.md).

<!-- FLUID_HARNESS_PUBLIC_STATUS:END -->


This repository is the first runnable slice of the cognitive-architecture plan. It is deliberately small: the goal is to make the architecture's control loop observable before adding more model-provider types, external tools, or broader forms of self-modification.

For a plan-by-plan status of what is implemented versus future scope, see [SCOPE_MATRIX.md](SCOPE_MATRIX.md).

In plain terms, Fluid-Harness is the control, evidence, and evaluation layer around future agents—not the agent brain and not an ASI system by itself. It is also becoming a bounded harness architect/researcher: it can help increasingly capable agents choose strategies, act, verify results, learn from evidence, retrieve bounded structured memories from prior runs, architecture experiments, coordination transcripts, supervised sessions, and pending research questions, prioritize bounded research handoffs, research alternatives, propose registered-component architecture configurations from summary-only research, adopt reproducible improvements, invoke narrowly bounded process-isolated tools, route natural-language work through an opt-in process-isolated model provider, and preserve a complete bounded run as data-only history. It now supports narrow, integrity-checked restore of learning context, agent-run history, standalone memory-aware ensemble quorum summaries, coordination transcripts, complete supervised-session summaries, pending-research summaries, and detailed architecture-discovery evidence across processes; ledger-derived memory entries also retain a frozen, read-only `{kind, sequence, hash}` locator back to their verified archive record; finite independent skeptic lineages can attack adversarial cases, aggregate weaknesses, archive the result, and inform a fresh planner or bounded proof-quorum ensemble without entering production promotion; a verifier-correlation audit can distinguish fresh runtime independence from shared verifier identifiers, preserving unresolved coverage as a review signal; a finite distribution-shift runner can test a fixed task under changed adversarial inputs with fresh dependencies per case, archive the robustness result, leave a bounded historical reminder, and feed that warning to a fresh process-isolated planner or architecture proposer without restoring execution authority; and a Harness Factory façade can run the bounded research-to-proposal-to-build-to-evaluate-to-replay-to-adopt pipeline, archive the detailed discovery transcript and explicit holdout-validation outcomes, retire evaluated candidates, build a fresh bounded agent on request, and use verified archive summaries to inform the next factory generation while returning only data-only lifecycle summaries. Model training, rich semantic or durable memory, live production-model credentials, shared-memory or open-ended multi-agent coordination, broad live-I/O tool integrations, arbitrary architecture invention, and real-world sandboxing remain future scope.

## Current kernel

The kernel performs one complete cycle:

```text
task
  -> scored representation selection
  -> reasoning engine and execution substrate
  -> bounded execution
  -> prediction
  -> observation
  -> surprise signal
  -> independent verification
  -> evidence-backed action report
  -> strategy profile update
```

The selector is deterministic and heuristic for now. It scores formal representations, records confidence, and falls back to a language-model strategy when the evidence is absent or tied. The registered deterministic executors currently include a breadth-first graph path solver, a resource-constrained scheduler, an array-computation engine, a bounded in-memory database-query engine, a finite propositional theorem checker, a finite exact Bayesian posterior engine, a finite state-machine simulator, a finite candidate optimizer, a bounded rooted search-tree evaluator, and a finite arithmetic program synthesizer. Database queries support explicit filtering, projection, stable sorting, and limiting over a small scalar row set; theorem checks exhaustively enumerate at most eight Boolean variables; Bayesian inference normalizes a bounded hypothesis table for one observed event; simulation replays at most 64 events through a finite transition table; optimization exhaustively selects a minimum or maximum from at most 64 numeric candidates with a deterministic tie-break; search-tree evaluation exhaustively scans at most 64 nodes under an explicit expansion budget with deterministic tie-breaking; program synthesis enumerates at most 2,048 data-only expressions over a fixed arithmetic grammar and checks finite input/output examples. For natural-language tasks, an opt-in process-isolated model-provider adapter returns frozen data-only text and an `OBSERVED` action; its observer verifier deliberately refuses semantic proof. These are not a live SQL engine, external database connector, general theorem prover, learned uncertainty model, open-ended probabilistic system, general-world simulator, general numerical optimizer, stochastic Monte Carlo service, arbitrary code execution, or guaranteed live LLM service. Graph, search-tree, and program-synthesis execution accept explicit budgets, allowing the harness to measure real success/proof curves instead of treating one benchmark point as sufficient.

Action reports carry:

- the selected strategy
- the prediction and observed outcome
- prediction error and surprise in nats
- BELIEVED, OBSERVED, or PROVEN evidence level
- verifier checks and their results
- a computed environment hash
- a reproduction procedure from the trusted verifier

Caller-supplied verification flags cannot produce `PROVEN`; only an execution produced by a registered executor and passed through its verifier can do so. Manual observations are recorded as `OBSERVED` without proof metadata.

The current kernel also has a narrow constitutional core: frozen resource limits, private state transitions, a hash-chained audit trail, policy-mode separation, and an explicit operator shutdown/resume path. Representation search now runs isolated selector candidates through that core, compares transfer performance across domains, and promotes only a research-and-skeptic-approved candidate. A separate planner-search layer compares competing process-isolated planners across production, research, and skeptic modes; an independent replay can authorize a fresh planner for production use, but cannot mutate code or grant architecture-level authority. A bounded architecture-search layer can now compare planner-plus-policy bundles as whole candidates, and a process-isolated proposer can suggest data-only combinations of registered planner components for parent-side resolution. Their components remain data-only and the parent runner remains the only proof path. A separate architecture replay authority can certify a matching fresh replay of a complete bundle evaluation, and a parent-controlled adoption authority can rebuild that certified bundle as a fresh candidate after threshold and definition checks. The discovery runner connects those steps into one bounded proposal-to-resolution-to-replay-to-adoption transaction, and the runtime adapter can build one fresh bounded agent from the adopted bundle so its planner still earns proof only through the parent runner. A bounded independent ensemble can run multiple such agents with distinct planners and runners and report a configurable proof quorum. A finite coordination runner can pass only frozen summaries from one round into the next; it cannot pass trusted reports, share constitutional state, or create collective authority. The evidence ledger can archive those rounds with a chain hash and transcript fingerprint, and can also archive the discovery transaction’s proposals, candidate definitions, per-mode/per-case outcomes, replay decision, and adoption decision as a separate fingerprinted data-only record. Restoration returns only plain data-only summaries—not agents, planners, run reports, adoption authority, or other runtime authority. Neither path invents arbitrary code or deploys an architecture. A sequential mutation authority exposes the nine-level privilege ladder and issues permits only after trusted, reproducible improvement; one bounded application path can apply a permit only to immutable agent episode and tool-call caps. The runner, planner, tool registry, core, and module code remain outside that mutation surface. The kernel has ten deterministic executors, independent verifiers, production/research/skeptic evaluation, and a scaling runner that records measured compute budgets, wall time, success rate, proof rate, and a Pareto frontier.

Each action also updates an immutable world-model history. Strategy profiles aggregate prediction accuracy, calibration gap, surprise, high-surprise cases, and the mix of observed versus proven outcomes, so repeated actions expose both recovery and evidence quality. The next plan captures the prior profile, and its prediction likelihood is updated from that history; action reports and cycle stages expose both the pre-action and post-action profiles.

Learning history entries always carry an explicit evidence level and a matching verification flag. Bare model measurements are conservatively stored as `BELIEVED`; only the harness's trusted verifier path records `PROVEN`.

A constitutional core separately exposes only snapshots derived from its accepted action reports, so a replaceable model cannot relabel its own history as constitutional evidence.

## Run it

```sh
npm test
npm run check
npm run demo
node src/cli.mjs array-demo
node src/cli.mjs database-demo
node src/cli.mjs theorem-demo
node src/cli.mjs bayesian-demo
node src/cli.mjs simulation-demo
node src/cli.mjs optimization-demo
node src/cli.mjs search-tree-demo
node src/cli.mjs program-synthesis-demo
node src/cli.mjs model-demo
node scripts/check-bayesian.mjs
node scripts/check-bayesian-boundary.mjs
node scripts/check-bayesian-evaluation.mjs
node scripts/check-bayesian-evaluation-boundary.mjs
node scripts/check-bayesian-cycle.mjs
node scripts/check-simulation.mjs
node scripts/check-simulation-boundary.mjs
node scripts/check-simulation-evaluation.mjs
node scripts/check-simulation-evaluation-boundary.mjs
node scripts/check-simulation-cycle.mjs
node scripts/check-optimization.mjs
node scripts/check-optimization-boundary.mjs
node scripts/check-optimization-evaluation.mjs
node scripts/check-optimization-evaluation-boundary.mjs
node scripts/check-optimization-cycle.mjs
node scripts/check-search-tree.mjs
node scripts/check-search-tree-boundary.mjs
node scripts/check-search-tree-evaluation.mjs
node scripts/check-search-tree-cycle.mjs
node scripts/check-program-synthesis.mjs
node scripts/check-program-synthesis-boundary.mjs
node scripts/check-program-synthesis-evaluation.mjs
node scripts/check-program-synthesis-cycle.mjs
node scripts/check-model-provider.mjs
node scripts/check-model-provider-boundary.mjs
node scripts/check-model-provider-evaluation.mjs
node scripts/check-model-provider-cycle.mjs
node scripts/check-theorem-evaluation.mjs
node scripts/check-theorem-evaluation-boundary.mjs
node scripts/check-theorem-cycle.mjs
node scripts/check-database-query-evaluation.mjs
node scripts/check-database-query-evaluation-boundary.mjs
node scripts/check-database-query-cycle.mjs
node scripts/check-array-arithmetic-boundary.mjs
node scripts/check-action-report-boundary.mjs
node scripts/check-action-report-verification-binding.mjs
node scripts/check-action-report-deep-immutability.mjs
node scripts/check-mutable-container-boundary.mjs
node scripts/check-function-value-boundary.mjs
node scripts/check-snapshot-value-boundary.mjs
node scripts/check-action-report-identity.mjs
node scripts/check-action-report-input-replay.mjs
node scripts/check-action-report-plan-replay.mjs
node scripts/check-action-report-reuse.mjs
node scripts/check-action-report-replay.mjs
node scripts/check-harness-execution-replay.mjs
node scripts/check-harness-input-isolation.mjs
node scripts/check-harness-dependency-stability.mjs
node scripts/check-harness-options-isolation.mjs
node scripts/check-candidate-definition-replay.mjs
node src/cli.mjs constraint-demo
node src/cli.mjs evaluate-demo
node src/cli.mjs scale-demo
node scripts/check-scaling-isolation.mjs
node scripts/check-scaling-dependency-isolation.mjs
node scripts/check-scaling-case-suite-isolation.mjs
node scripts/check-scaling-registry-internals.mjs
node scripts/check-constitution-boundary.mjs
node scripts/check-constitutional-options-boundary.mjs
node scripts/check-constitutional-options-value-boundary.mjs
node scripts/check-safe-integer-boundary.mjs
node scripts/check-configuration-safe-integer-boundary.mjs
node scripts/check-constraint-large-duration.mjs
node scripts/check-constraint-time-overflow-boundary.mjs
node scripts/check-constraint-key-normalization-boundary.mjs
node scripts/check-constraint-input-shape-boundary.mjs
node scripts/check-executor-input-container-boundary.mjs
node scripts/check-observation-immutability.mjs
node scripts/check-proto-snapshot-boundary.mjs
node scripts/check-sparse-array-boundary.mjs
node scripts/check-executor-dense-input-boundary.mjs
node scripts/check-direct-executor-array-method-boundary.mjs
node scripts/check-array-prototype-isolation.mjs
node scripts/check-numeric-predicate-isolation.mjs
node scripts/check-math-intrinsic-isolation.mjs
node scripts/check-json-serialization-isolation.mjs
node scripts/check-object-entry-isolation.mjs
node scripts/check-object-key-isolation.mjs
node scripts/check-object-from-entries-isolation.mjs
node scripts/check-freeze-tamper-boundary.mjs
node scripts/check-function-hasinstance-isolation.mjs
node scripts/check-property-introspection-isolation.mjs
node scripts/check-evaluation-aggregation-isolation.mjs
node scripts/check-evolution-aggregation-isolation.mjs
node scripts/check-search-adoption-isolation.mjs
node scripts/check-constitutional-audit-isolation.mjs
node scripts/check-question-freeze-boundary.mjs
node scripts/check-deep-freeze-boundary.mjs
node scripts/check-learning-intrinsic-isolation.mjs
node scripts/check-scaling-aggregation-isolation.mjs
node scripts/check-search-audit-push-isolation.mjs
node scripts/check-executor-freeze-isolation.mjs
node scripts/check-audit-iterator-isolation.mjs
node scripts/check-cycle-freeze-boundary.mjs
node scripts/check-array-iterator-isolation.mjs
node scripts/check-weak-registry-isolation.mjs
node scripts/check-collection-intrinsic-isolation.mjs
node scripts/check-selector-definition-intrinsic-isolation.mjs
node scripts/check-learning-history-iterator-isolation.mjs
node scripts/check-snapshot-property-boundary.mjs
node scripts/check-constitutional-input-snapshot.mjs
node scripts/check-constitutional-value-boundary.mjs
node scripts/check-constitutional-property-boundary.mjs
node scripts/check-constitutional-accessor-boundary.mjs
node scripts/check-constitutional-tojson-boundary.mjs
node scripts/check-audit-capacity-atomicity.mjs
node scripts/check-evaluation-audit-capacity.mjs
node scripts/check-core-harness-isolation.mjs
node scripts/check-sandbox-boundary.mjs
node src/cli.mjs search-demo
node scripts/check-search-isolation.mjs
node scripts/check-search-case-suite-isolation.mjs
node scripts/check-search-mode-definition-drift.mjs
node scripts/check-search-constitution-stability.mjs
node scripts/check-search-promotion-authority-stability.mjs
node scripts/check-search-production-promotion-boundary.mjs
node scripts/check-selector-adoption-revalidation.mjs
node scripts/check-selector-adoption-stability.mjs
node scripts/check-selector-adoption-research-boundary.mjs
node scripts/check-promoted-adoption-completeness.mjs
node scripts/check-promotion-completeness-label.mjs
node scripts/check-promotion-evidence-boundary.mjs
node src/cli.mjs evolution-demo
node scripts/check-evolution-completeness-boundary.mjs
node scripts/check-evolution-definition-drift.mjs
node scripts/check-evolution-evidence-drift.mjs
node scripts/check-evolution-promotion-policy-boundary.mjs
node src/cli.mjs cycle-demo
node src/cli.mjs curiosity-demo
node src/cli.mjs research-scheduler-demo
node src/cli.mjs learning-demo
node src/cli.mjs ledger-demo
node src/cli.mjs failure-demo
node scripts/check-failure-error-preservation.mjs
node src/cli.mjs skeptic-demo
node scripts/check-learning-boundary.mjs
node scripts/check-learning-verification-replay.mjs
node scripts/check-evidence-ledger-boundary.mjs
node scripts/check-evidence-ledger-world-model-restore.mjs
node scripts/check-process-boundary.mjs
node scripts/check-process-selector-adoption.mjs
node scripts/check-process-executor-proof.mjs
node scripts/check-tool-boundary.mjs
node scripts/check-tool-failure-boundary.mjs
node scripts/check-tool-registry-boundary.mjs
node scripts/check-agent-tool-bridge.mjs
node scripts/check-agent-planner-boundary.mjs
node scripts/check-agent-planner-execution.mjs
node scripts/check-agent-planner-search.mjs
node scripts/check-agent-planner-search-boundary.mjs
node scripts/check-agent-planner-reproducibility.mjs
node scripts/check-agent-planner-promotion-boundary.mjs
node scripts/check-agent-planner-adoption.mjs
node scripts/check-agent-architecture-search.mjs
node scripts/check-agent-architecture-boundary.mjs
node scripts/check-agent-architecture-proposal.mjs
node scripts/check-agent-architecture-proposal-boundary.mjs
node scripts/check-agent-architecture-reproducibility.mjs
node scripts/check-agent-architecture-reproducibility-boundary.mjs
node scripts/check-agent-architecture-adoption.mjs
node scripts/check-agent-architecture-adoption-boundary.mjs
node scripts/check-agent-architecture-discovery.mjs
node scripts/check-agent-architecture-discovery-boundary.mjs
node scripts/check-agent-architecture-discovery-ledger.mjs
node scripts/check-agent-architecture-discovery-ledger-boundary.mjs
node scripts/check-agent-architecture-discovery-ledger-rejection.mjs
node scripts/check-agent-architecture-runtime.mjs
node scripts/check-agent-architecture-runtime-boundary.mjs
node scripts/check-agent-architecture-ensemble.mjs
node scripts/check-agent-architecture-ensemble-boundary.mjs
node scripts/check-agent-architecture-coordination.mjs
node scripts/check-agent-architecture-coordination-boundary.mjs
node scripts/check-agent-architecture-coordination-ledger.mjs
node scripts/check-agent-architecture-coordination-ledger-boundary.mjs
node scripts/check-agent-architecture-session.mjs
node scripts/check-agent-architecture-session-boundary.mjs
node scripts/check-agent-architecture-scaling.mjs
node scripts/check-agent-architecture-scaling-boundary.mjs
node scripts/check-agent-policy-mutation-boundary.mjs
node scripts/check-agent-policy-application.mjs
node scripts/check-agent-run-ledger-boundary.mjs
node scripts/check-agent-run-ledger-restore.mjs
node scripts/check-agent-continuation-boundary.mjs
node scripts/check-agent-continuation-rejection.mjs
node scripts/check-agent-research-replay.mjs
node scripts/check-agent-research-replay-rejection.mjs
node scripts/check-research-queue-boundary.mjs
node scripts/check-research-queue-archive.mjs
node scripts/check-research-scheduler.mjs
node scripts/check-research-scheduler-boundary.mjs
node scripts/check-agent-research-scheduler.mjs
node scripts/check-agent-research-batch.mjs
node scripts/check-agent-research-batch-boundary.mjs
node scripts/check-structured-memory.mjs
node scripts/check-structured-memory-boundary.mjs
node scripts/check-memory-planner-context.mjs
node scripts/check-memory-planner-context-boundary.mjs
node scripts/check-structured-memory-ledger.mjs
node scripts/check-structured-memory-ledger-boundary.mjs
node scripts/check-structured-memory-architecture-discovery.mjs
node scripts/check-structured-memory-architecture-discovery-boundary.mjs
node scripts/check-memory-ledger-architecture-discovery-planner.mjs
node scripts/check-memory-ledger-architecture-discovery-planner-boundary.mjs
node scripts/check-structured-memory-session.mjs
node scripts/check-structured-memory-session-boundary.mjs
node scripts/check-structured-memory-coordination.mjs
node scripts/check-structured-memory-coordination-boundary.mjs
node scripts/check-structured-memory-research.mjs
node scripts/check-structured-memory-research-boundary.mjs
node scripts/check-structured-memory-provenance.mjs
node scripts/check-structured-memory-provenance-boundary.mjs
node scripts/check-adversarial-lineage.mjs
node scripts/check-adversarial-lineage-boundary.mjs
node scripts/check-adversarial-lineage-ensemble.mjs
node scripts/check-adversarial-lineage-ensemble-boundary.mjs
node scripts/check-adversarial-lineage-ledger.mjs
node scripts/check-adversarial-lineage-ledger-boundary.mjs
node scripts/check-structured-memory-adversarial-lineage.mjs
node scripts/check-structured-memory-adversarial-lineage-boundary.mjs
node scripts/check-structured-memory-adversarial-lineage-ensemble.mjs
node scripts/check-structured-memory-adversarial-lineage-ensemble-boundary.mjs
node scripts/check-memory-ledger-adversarial-lineage-ensemble-planner.mjs
node scripts/check-memory-ledger-adversarial-lineage-ensemble-planner-boundary.mjs
node scripts/check-memory-aware-agent-adversarial-lineage-ensemble.mjs
node scripts/check-memory-aware-agent-adversarial-lineage-ensemble-boundary.mjs
node scripts/check-memory-aware-agent-ensemble-ledger.mjs
node scripts/check-memory-aware-agent-ensemble-ledger-boundary.mjs
node scripts/check-memory-aware-agent-ensemble-ledger-non-quorum.mjs
node scripts/check-structured-memory-memory-aware-ensemble.mjs
node scripts/check-structured-memory-memory-aware-ensemble-boundary.mjs
node scripts/check-memory-ledger-memory-aware-ensemble-planner.mjs
node scripts/check-memory-ledger-memory-aware-ensemble-planner-boundary.mjs
node scripts/check-verifier-correlation.mjs
node scripts/check-verifier-correlation-boundary.mjs
node scripts/check-distribution-shift.mjs
node scripts/check-distribution-shift-boundary.mjs
node scripts/check-distribution-shift-ledger.mjs
node scripts/check-distribution-shift-ledger-boundary.mjs
node scripts/check-structured-memory-distribution-shift.mjs
node scripts/check-structured-memory-distribution-shift-boundary.mjs
node scripts/check-memory-ledger-distribution-shift-planner.mjs
node scripts/check-memory-ledger-distribution-shift-planner-boundary.mjs
node scripts/check-agent-architecture-research-proposal.mjs
node scripts/check-agent-architecture-research-proposal-boundary.mjs
node scripts/check-harness-factory.mjs
node scripts/check-harness-factory-boundary.mjs
node scripts/check-harness-factory-agent.mjs
node scripts/check-harness-factory-agent-boundary.mjs
node scripts/check-harness-factory-improvement.mjs
node scripts/check-harness-factory-improvement-boundary.mjs
node scripts/check-harness-factory-research-agenda.mjs
node scripts/check-harness-factory-research-agenda-boundary.mjs
node scripts/check-harness-factory-benchmark.mjs
node scripts/check-harness-factory-benchmark-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign.mjs
node scripts/check-harness-factory-benchmark-campaign-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-archive.mjs
node scripts/check-harness-factory-benchmark-campaign-archive-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-history.mjs
node scripts/check-harness-factory-benchmark-campaign-history-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-validation.mjs
node scripts/check-harness-factory-benchmark-campaign-validation-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-validation-archive.mjs
node scripts/check-harness-factory-benchmark-campaign-validation-archive-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-validation-history.mjs
node scripts/check-harness-factory-benchmark-campaign-validation-history-boundary.mjs
node scripts/check-harness-factory-benchmark-validation-memory-improvement.mjs
node scripts/check-harness-factory-benchmark-validation-memory-improvement-boundary.mjs
node scripts/check-harness-factory-benchmark-validation-scorecard.mjs
node scripts/check-harness-factory-benchmark-validation-scorecard-boundary.mjs
node scripts/check-harness-factory-benchmark-validation-research-agenda.mjs
node scripts/check-harness-factory-benchmark-validation-research-agenda-boundary.mjs
node scripts/check-harness-factory-benchmark-validation-research-execution.mjs
node scripts/check-harness-factory-benchmark-validation-research-execution-boundary.mjs
node scripts/check-harness-factory-benchmark-validation-stability.mjs
node scripts/check-harness-factory-benchmark-validation-stability-boundary.mjs
node scripts/check-harness-factory-benchmark-campaign-frontier-validation.mjs
node scripts/check-harness-factory-benchmark-campaign-frontier-validation-boundary.mjs
node scripts/check-harness-factory-benchmark-frontier-validation-scorecard.mjs
node scripts/check-harness-factory-benchmark-frontier-validation-scorecard-boundary.mjs
node scripts/check-harness-factory-campaign-memory-improvement.mjs
node scripts/check-harness-factory-campaign-memory-improvement-boundary.mjs
node scripts/check-memory-ledger-adversarial-lineage-planner.mjs
node scripts/check-memory-ledger-adversarial-lineage-planner-boundary.mjs
node scripts/check-memory-ledger-session-planner.mjs
node scripts/check-memory-ledger-session-planner-boundary.mjs
node scripts/check-memory-ledger-coordination-planner.mjs
node scripts/check-memory-ledger-coordination-planner-boundary.mjs
node scripts/check-memory-ledger-research-planner.mjs
node scripts/check-memory-ledger-research-planner-boundary.mjs
node scripts/check-memory-ledger-planner-cycle.mjs
node scripts/check-memory-aware-agent.mjs
node scripts/check-memory-aware-agent-boundary.mjs
node scripts/check-memory-aware-agent-research.mjs
node scripts/check-memory-aware-agent-research-boundary.mjs
node scripts/check-memory-aware-agent-research-batch.mjs
node scripts/check-memory-aware-agent-research-batch-boundary.mjs
node scripts/check-memory-aware-agent-persistence.mjs
node scripts/check-memory-aware-agent-persistence-boundary.mjs
node scripts/check-memory-aware-agent-promotion.mjs
node scripts/check-memory-aware-agent-promotion-boundary.mjs
node scripts/check-memory-aware-agent-architecture.mjs
node scripts/check-memory-aware-agent-architecture-boundary.mjs
node scripts/check-memory-aware-agent-architecture-lineage.mjs
node scripts/check-memory-aware-agent-architecture-lineage-boundary.mjs
node scripts/check-memory-aware-agent-architecture-transition.mjs
node scripts/check-memory-aware-agent-architecture-transition-boundary.mjs
node scripts/check-memory-aware-agent-architecture-discovery.mjs
node scripts/check-memory-aware-agent-architecture-discovery-boundary.mjs
node scripts/check-memory-aware-agent-ensemble.mjs
node scripts/check-memory-aware-agent-ensemble-boundary.mjs
node scripts/check-memory-aware-agent-coordination.mjs
node scripts/check-memory-aware-agent-coordination-non-quorum.mjs
node scripts/check-memory-aware-agent-coordination-boundary.mjs
node scripts/check-memory-aware-agent-coordination-ledger-boundary.mjs
node scripts/check-memory-aware-agent-session.mjs
node scripts/check-memory-aware-agent-session-boundary.mjs
node scripts/check-memory-aware-agent-scaling.mjs
node scripts/check-memory-aware-agent-scaling-boundary.mjs
node scripts/check-memory-aware-agent-scaling-non-quorum.mjs
node scripts/check-agent-runner-boundary.mjs
node scripts/check-agent-research-continuation.mjs
node src/cli.mjs agent-demo
node scripts/check-structured-observation-equality.mjs
node scripts/check-constitutional-surprise-threshold.mjs
node scripts/check-constitutional-surprise-threshold-stability.mjs
node scripts/check-constitutional-learning-history.mjs
node scripts/check-world-model-signal-consistency.mjs
node scripts/check-world-model-value-domain.mjs
node scripts/check-world-model-history-immutability.mjs
node scripts/check-proven-learning-boundary.mjs
node scripts/check-mutation-replay.mjs
node scripts/check-reproducibility-boundary.mjs
node scripts/check-evaluation-report-replay.mjs
node scripts/check-evaluation-options-isolation.mjs
node scripts/check-question-boundary.mjs
node scripts/check-question-source.mjs
node scripts/check-question-replay.mjs
node scripts/check-question-research-boundary.mjs
node scripts/check-question-core-ownership.mjs
node scripts/check-question-policy-boundary.mjs
node scripts/check-planning-boundary.mjs
node scripts/check-plan-boundary.mjs
node scripts/check-plan-core-isolation.mjs
node scripts/check-plan-replay.mjs
node scripts/check-promotion-replay.mjs
node scripts/check-promotion-authority-isolation.mjs
node scripts/check-trusted-prototype-tamper.mjs
node scripts/check-cross-candidate-prototype-boundary.mjs
node scripts/check-skeptic-candidate-boundary.mjs
node scripts/check-evaluation-suite-boundary.mjs
node scripts/check-evaluation-runner-boundary.mjs
node scripts/check-record-verification-boundary.mjs
node scripts/check-cycle-boundary.mjs
node scripts/check-cycle-audit-ownership.mjs
node scripts/check-cycle-audit-capacity.mjs
node scripts/check-cycle-research-boundary.mjs
node scripts/check-cycle-research-failure-audit.mjs
node scripts/check-cycle-question-consistency.mjs
node scripts/check-selector-candidate-boundary.mjs
node scripts/check-selector-adoption-isolation.mjs
node scripts/check-selector-factory-isolation.mjs
node scripts/check-evaluation-case-immutability.mjs
node scripts/check-evaluation-case-id-boundary.mjs
node scripts/check-evaluation-candidate-boundary.mjs
node scripts/check-evaluation-plan-task-boundary.mjs
node scripts/check-evaluation-task-immutability.mjs
node scripts/check-evaluation-task-property-boundary.mjs
node scripts/check-verification-replay.mjs
node scripts/check-execution-replay.mjs
node scripts/check-execution-reuse.mjs
node scripts/check-execution-identity.mjs
node scripts/check-execution-input.mjs
node scripts/check-executor-registry-input-isolation.mjs
node scripts/check-executor-registry-identity-isolation.mjs
node scripts/check-selector-freshness.mjs
node scripts/check-question-audit.mjs
```

To enable the tracked documentation and GitHub-description pre-commit hook in a fresh clone, run:

```sh
git config core.hooksPath .githooks
```

Each local commit refreshes `README.md`, `docs/STATUS.md`, and `.github/repository-description.txt`. When GitHub CLI authentication and the `origin` repository are available, it also synchronizes the repository description; otherwise the commit remains local and prints a non-blocking skip notice.

The graph demo represents a dependency problem as a graph, executes a shortest-path search, independently verifies the result, and emits a proof-carrying report. The constraint demo schedules dependent jobs against CPU capacity and verifies every job, prerequisite, capacity, and makespan invariant. The array demo routes an elementwise sum to a deterministic array engine and independently checks the operation, shape, and values.

The evaluation demo runs production-eligible cases separately from the research suite, reports transfer rates by domain, and only promotes the candidate after the complete research budget and skeptic suite pass. Evaluation case inputs and execution options are snapshotted and deeply frozen, so later caller or custom-executor mutation cannot change the suite or budget being measured. Evaluation runners require a real `FluidHarness`, and every action report must be trusted by that harness and bound to the exact plan being evaluated; fake harnesses and forged reports become failed cases rather than proof. An action report can be consumed by evaluation only once, so a custom execution hook cannot make one real action look like repeated evidence across the same or another runner. A constitutional core records ownership of its primary evaluation report, so a report from another core cannot be replayed into its promotion audit; promotion also requires the skeptic report to identify the same candidate and exact trusted case suite as the primary report. Skeptic cases may succeed by proving that malformed or ambiguous inputs are safely refused rather than executed; every adversarial miss is counted as a weakness exposed, and promotion rejects a skeptic report with exposed weaknesses. The scaling demo runs the same deep graph under expansion budgets of 1, 3, and 6: partial searches remain unproven, while the sufficient budget reaches an independently verified result. Each budget level receives a fresh harness and fresh selector, world model, executor registry, and verifier registry; shared dependencies are rejected so hidden state cannot contaminate the curve. Its frontier removes the dominated middle budget.

Evaluation budgets and cases are also factory-trusted value objects. Frozen objects that merely inherit from their prototypes, derived instances, and proxies cannot change case eligibility, expected outcomes, or the action budget admitted to evaluation.

Evaluation reports can only be branded by an exact factory-created runner. A derived or proxied runner cannot override case execution and turn forged results into promotion evidence.

Scaling also rejects shared executor instances and custom verifier functions hidden inside otherwise fresh registries.

Scaling levels are snapshotted into exact factory-created values before measurement, so prototype-only, derived, or proxied level objects cannot inject dynamic identifiers, budgets, or execution options into the curve.

`AgentArchitectureSessionScalingRunner` extends that measurement discipline to the supervised architecture session. It evaluates fresh session runners at finite agent-count and coordination-round levels, records completion, quorum, proof rate, elapsed time, and declared compute units, and computes a Pareto frontier from data-only points. This is a fan-out/round scaling experiment over the current deterministic fixture; it is not a measurement of model strength, tokens, real parallel workers, or general-world performance.

The constitutional boundary limits action count, graph expansions, input bytes, and representation-specific collection sizes, records admissions/completions/failures, question decisions, and policy modes in a SHA-256 hash chain, and blocks execution while shutdown is latched. Each mutable harness can belong to only one constitutional core, so world-model learning cannot leak between cores. It also requires the harness-owned action report to match the current plan’s task and strategy identity. Question audits carry the current harness-owned action report, so a decision from another action cannot be replayed. The boundary scripts check that resource-limited actions remain `OBSERVED`, over-limit and cyclic inputs are rejected before admission, shutdown blocks work, resume is explicit, and the audit chain remains verifiable. This is an in-process resource envelope, not a claim of OS-level sandbox isolation.

Audit capacity is part of the boundary too: an action reserves room for both admission and completion before it runs, and shutdown or question state changes happen only after their audit entry is accepted. A full audit log therefore rejects the operation without silently changing core state.

Whole evaluations and complete cognitive cycles use the same discipline: the core estimates the bounded audit entries needed for evaluation start, per-case actions, and completion, while a cycle reserves room for action admission, completion, and its question decision before acting.

Plans and action reports are factory-trusted: frozen objects that merely look like either object cannot cross the harness or constitutional execution boundary, plans are bound to the ConstitutionalCore that created them, and plans or reports from a different harness or core cannot be replayed into the current core. Each trusted action report is also bound to the exact plan that produced it, so a report from another same-task plan cannot be replayed into the current action. Task objects receive the same treatment: plain objects, subclasses, and proxies are snapshotted into exact trusted tasks before a Plan can carry them.

The search demo compares a graph-biased selector with the default heuristic over graph, constraint, and robustness cases. The case suite is snapshotted before any candidate code runs, so a candidate cannot shrink or replace the cases seen by later policy modes. Production, research, and skeptic policy modes run with fresh selectors, selector factories, promotion authorities, world models, and constitutional audit chains, so exploration cannot contaminate production state. A candidate that returns the same selector object for multiple modes, shares one with another candidate, reuses one selector factory or promotion authority, or returns a selector already consumed by search during production adoption, is rejected rather than allowed to share hidden state. The default candidate wins transfer scoring and promotion; the graph-biased candidate is retained as a measured failed alternative. Only a fresh selector from the trusted promoted candidate is then adopted by a production routing harness, where it must still produce a PROVEN result.

Adoption also replays the complete research suite with the fresh selector. A selector that passes production revalidation but changes its behavior on adversarial research cases is rejected before it can become the routing policy.

Adoption repeats both the production and research replay before returning the selector, so a stateful selector that changes during the adoption transaction is rejected. This is a finite consistency check, not a proof that arbitrary future JavaScript behavior is pure; promoted selectors remain an extension point and should be treated as untrusted code outside the evidence that was replayed.

Policy-mode isolation compares observed evidence, not source-code identity. A candidate may return different fresh selector implementations for production, research, and skeptic modes when they produce consistent evidence; stronger guarantees require an explicit selector contract or a process-level sandbox outside this in-process kernel.

Search candidate metadata is normalized into exact factory-created candidates before it enters a trusted search report; prototype-only, derived, and proxied candidate objects cannot carry dynamic identity or policy metadata into the result.


Representation selections are snapshotted before strategy construction as well. A frozen object with inherited accessors cannot keep changing the selection metadata inside an otherwise immutable plan or action report.

The evolution demo attempts to skip directly to module-level mutation and is refused, then approves a prompt-level permit only after an independent second search run over the same frozen case suite and candidate definitions reproduces the baseline and candidate metrics. Reproducibility and improvement cover production success/proof as well as research, skeptic, and transfer metrics, so a research gain cannot hide a production regression or a different implementation cannot borrow another candidate’s scores. A caller’s `reproducible: true` claim is not accepted as evidence. Proposals and permits are bound to the issuing evolution authority, so mutation artifacts cannot be replayed against a different sequential state. Higher levels remain locked until the immediately preceding level demonstrates non-regressing, strictly improved, reproducible metrics.

The mutation boundary independently requires complete production, research, and skeptic success with no exposed skeptic weaknesses. A lower-level search policy cannot grant a mutation permit merely by returning `promoted: true` under relaxed thresholds.

The policy-mutation boundary binds a level-3 permit to exact immutable baseline and candidate `AgentPolicy` fingerprints. Applying it consumes the permit once, returns frozen previous/current snapshots, and rejects foreign authorities, mismatched policies, replay, and search-only permits. The application check shows that only episode and tool-call caps change; a constrained runner refuses over-budget work before action, while a new runner built from the previous snapshot provides explicit rollback. This is bounded configuration evolution, not arbitrary code replacement or self-rewriting.

The cycle demo composes the complete control loop into immutable stage data: understand, represent, predict, act, learn, verify, question via research, and preserve. Research remains a separate candidate evaluation path, and an incomplete or structurally failed search cannot be counted as completed research. The production action remains backed by the constitutional audit and deterministic verifier.

If supplied research fails after the action has completed, the runner preserves the original research error but records an explicit unresolved-research question in the constitutional audit, so a partial cycle cannot look complete or lose its research obligation.

Cycle research orchestration also requires the exact factory-trusted search runner. Prototype-only, derived, or proxied runners cannot substitute an override that returns research artifacts outside the runner’s own controlled path.

The curiosity demo shows the question policy in action: a proven but surprising no-path result and an observed resource-limited result both request investigation and mark research as required. A settled, low-surprise, proven result does not ask a question unless research is explicitly supplied.

Research-required questions are also copied into a constitutional core-owned handoff queue. A bounded scheduler ranks those data-only snapshots by surprise, evidence, and stable action order, but it cannot receive the action report or resolve the queue item. The bounded agent runner can bind a finite caller-supplied research specification list to the exact scheduled task IDs, preflight ownership, resolve them in rank order with fresh complete trusted search reports, and return an immutable batch receipt. An incomplete, failed, shutdown, forged, accessor-bearing, reordered, or stale handoff stops or rejects the batch without silently consuming later work. This is bounded priority scheduling and handoff execution, not yet an autonomous experiment planner or research scheduler.

Core checkpoints include pending queue items in the evidence ledger. A later process can restore those work items for handoff, but the restored item is not the original action report and cannot be used to mutate or resolve a new core without fresh operator-owned admission.

The bounded agent demo runs a sequence of episodes through the same cognitive-cycle runner. It stops before blindly continuing after a research-required surprise, preserves errors as explicit run status, and returns immutable cycle evidence. The continuation check resolves one owned research handoff, preserves incomplete/error/shutdown outcomes, and starts a new finite batch only after successful resolution. A process-isolated planner can now propose a schema-checked finite episode plan, including an explicit tool-input handoff; the parent runner still owns execution and verification. A trusted structured-memory retrieval can be packaged as a frozen historical/data-only context and passed through the process boundary to a planner, but that context cannot create an action report, mint proof, or transfer authority. The new memory-aware agent wrapper composes verified ledger history, read-only memory context, a fresh planner, and a fresh bounded runner; its ledger factory can construct that runner with restored world-model context and policy, inject a fresh process-isolated tool registry, return only a bounded summary receipt that marks tool output `OBSERVED`, resolve a pending research handoff through a separate data-only receipt, schedule or resolve a finite rank-ordered research batch through another summary-only receipt, append its own fresh run internally through a hash-verified ledger receipt so the next fresh agent can inherit the new history, and accept a planner only after independent promotion/replay through a dedicated fresh-planner factory. Incomplete or failed research remains pending, and the wrapper does not revive archived authority or expose the trusted schedule, search, action, run, or promotion artifacts. Its runner cannot be reused through the wrapper after the one bounded run. The planner-search checks compare fresh planner and runner instances across production, research, and skeptic modes, reject malformed or oversized output, and keep planner output separate from constitutional proof. A separate authority can require an independent replay of the exact case, budget, and planner definition before returning a fresh planner for production use. This is an agent-loop façade with bounded planner output and read-only memory context, not a self-directed long-lived agent or automatic architecture-invention system.

The adopted-architecture memory-aware check connects an independently replayed planner-plus-policy bundle to restored ledger memory and a fresh parent proof path. The architecture bundle is still rebuilt as fresh runtime dependencies, and its summary receipt exposes neither the adoption artifact nor the underlying action report.

The architecture-lineage check runs two fresh generations from that adopted bundle. The first generation persists its bounded run, including the data-only architecture ID in the verified agent-run ledger record, and the next generation restores the expanded ledger history while exposing the current ID plus the predecessor ID derived from that ledger; each generation earns new proof, and callers cannot inject lineage metadata into the ordinary memory-aware factories.

The architecture-transition check repeats that flow with two independently replayed adoptions. Architecture B replaces architecture A only as a fresh bounded dependency, inherits A's verified history, and earns its own proof; ledger-derived memory can filter the two generations by architecture ID, while the transition itself remains controlled architecture migration, not autonomous deployment or self-rewriting.

The architecture-discovery check connects the full finite proposal→resolution→independent replay→adoption transaction directly to memory-aware construction. A complete discovery report can build a fresh agent without exposing the discovery or adoption artifact in its summary receipt; incomplete, forged, or accessor-bearing transaction inputs are rejected.

The memory-aware ensemble check constructs multiple fresh agents from the same independently adopted architecture and verified history, runs them once, and returns only immutable member summaries plus a bounded proof quorum. Planners and bounded runners must be distinct, the factory caps the ensemble at four agents, and a quorum report cannot expose the underlying agents or action reports; each planner receives a parent-supplied member index as read-only context for controlled diversity tests. This is supervised redundant execution, not shared-memory coordination or autonomous collective agency.

The memory-aware coordination check composes those summary-only ensembles across a finite number of rounds. Each round constructs fresh agents from the current verified ledger, persists only summary receipts, and gives the next round frozen peer facts plus a parent-derived consensus summary of counts and quorum state; a parent-supplied member index is read-only planner context, not shared authority. The report records ledger growth and retryable quorum status without exposing agents, action reports, adoption authority, or a shared memory space. A separate non-quorum check injects one deterministic member failure and confirms that partial persistence, failed quorum, and `NOT_PROVEN` status remain explicit across both rounds and transcript restoration. Its transcript can be appended to the hash-chained ledger and restored as frozen data-only summaries with a content fingerprint, including consensus consistency checks but never a trusted coordination report. This is parent-mediated supervised coordination, not autonomous multi-agent operation.

The memory-aware session check composes finite architecture discovery with that summary-only coordination path. It requires a complete independently replayed adoption, starts from a caller-supplied verified ledger, constructs fresh agents for each round, and returns only a data-only discovery summary plus coordination summaries. Its session-ledger check archives that complete summary with the adopted architecture definition fingerprint and a separate session fingerprint, then restores it without the session runner, discovery/adoption artifacts, agents, planners, action reports, or authority. It is a supervised orchestration façade, not an autonomous self-improving session or an artificial-general/superintelligence system.

The memory-aware scaling check measures that supervised session at finite two- and three-agent levels. Each level receives a fresh session, discovery runner, coordination runner, and ledger; the result records elapsed time, completion, proof/quorum, persistence, and a data-only Pareto frontier. Its non-quorum companion confirms that a failed level becomes an incomplete zero-proof point with partial-persistence metrics, rather than disappearing from the curve. These are deterministic fixture measurements of bounded fan-out and rounds, not model-strength, token, parallel-worker, context-size, or general-world performance claims.

The learning demo repeats one graph action under a bounded search budget. It records a proven result, an observed resource-limit result, and a proven recovery, then prints the strategy profile that learned the prediction error and evidence mix. Direct world-model updates cannot mint `PROVEN` history without a factory-trusted verification object bound to the current execution and matching observation; each execution can contribute trusted learning evidence only once.

The evidence-ledger demo serializes trusted action evidence into an append-only hash chain and reloads it with integrity verification. The archive can rebuild a data-only world-model history for a new process, so the next plan can use prior attempts as context. A bounded agent run can also be recorded with its planner identity, effective policy snapshot, tool outcomes, stop reason, pending research, and cycle history; a verified restored ledger can seed a separate `LEDGER`-sourced structured-memory view for read-only retrieval. Completed memory-aware coordination and supervised-session reports can likewise be archived as nested, fingerprinted, data-only summaries. Finite skeptic-lineage summaries and multi-lineage skeptic aggregates can be archived too, preserving explicit weakness and incomplete-run metrics while omitting runners, harnesses, action reports, and promotion authority. Loaded records still cannot be presented as fresh trusted action, cycle, tool, policy, agent-run, coordination, session, adversarial-lineage, or adversarial-lineage-ensemble artifacts: the resumed constitutional core starts with zero actions and an empty audit, and a new action must earn its own proof. This is a narrow evidence/history restore, not full persistent memory, live-core resume, authenticity of archive authorship, or process/OS sandboxing.

Distribution-shift reports extend that archive as strict baseline/shift summaries. Restoration and the coarse memory form preserve robustness or weakness status and read-only chain provenance, but never restore shifted inputs, evaluators, action reports, or promotion authority. A source-filtered memory query can carry that bounded warning into a fresh process-isolated planner or architecture proposer; the parent still resolves registered components, validates the built agent, and earns any new proof. They remain historical research evidence, not fresh proof.

Verified standalone architecture-discovery records can also enter bounded structured memory as historical summaries tagged with their candidate outcome (`adopted` or `rejected`) and reproducibility/completeness status. Callers can filter retrieval by the trusted source identifier, so architecture history can be separated from ordinary agent-run history. The memory entry is `ARCHITECTURE_DISCOVERY`-sourced and `OBSERVED`, does not invent surprise or proof, and carries no runner, planner, adoption authority, or action evidence; detailed definitions, fingerprints, and per-case metrics remain in the hash-chained ledger. This is a way to help later bounded work remember which experiments happened, not a way to restore or trust an old architecture.

A verified discovery summary can reach a fresh process-isolated planner through that source filter. The planner receives only the frozen memory context, the parent validates the bounded plan, and the fresh runner earns any new `PROVEN` action evidence; a source mismatch or malformed query is rejected before execution. The resulting receipt exposes only the query and match count, not the archived discovery record or planner authority.

Archived supervised-session summaries can enter the same bounded memory as `SESSION`-sourced historical entries. They preserve a coarse quorum, persistence, completion, and architecture identity signal for retrieval, but remain `OBSERVED` data with no session runner, coordination transcript, discovery artifact, or authority attached.

Archived memory-aware coordination transcripts can likewise enter as `COORDINATION`-sourced historical entries. They preserve only coarse quorum, persistence, completion, round, and agent-count signals; the underlying peer messages, member runs, consensus objects, and coordination authority remain in the verified ledger boundary.

Ledger-derived structured-memory entries retain only read-only provenance: the verified record kind, sequence number, and hash. The locator helps an operator audit where a historical summary came from, but it does not transfer the record payload, upgrade `OBSERVED` evidence, recreate authority, or make a memory entry a proof artifact. Caller-created and ordinary agent-run memory retains `null` provenance unless it is explicitly supplied as data.

The finite skeptic lineage is a separate adversarial descendant boundary. It creates a fresh trusted evaluation runner and harness for a bounded adversarial suite, returns only frozen weakness metrics and case summaries, and is explicitly ineligible for production promotion. A bounded skeptic ensemble can repeat that suite through multiple fresh lineage runners and aggregate the results, making runtime independence visible without turning the aggregate into authority. Reusing a runner or harness, passing malformed or non-adversarial cases, or attempting to treat the lineage summary as an evaluation report is rejected. Its summary can be appended to the hash-chained ledger, restored only as frozen historical data, and imported into structured memory as an `ADVERSARIAL_LINEAGE` reminder; even an incomplete run remains explicitly incomplete rather than being silently treated as a complete evaluation. A verifier-correlation audit compares the per-case verifier identifiers across those fresh lineages: one shared identifier is reported as correlated, more than one as diverse, and any missing identifier as unresolved. The audit is itself `OBSERVED` summary data and cannot promote a candidate, mint proof, or expose the underlying runners or action reports. A separate distribution-shift runner holds the task contract fixed, requires changed adversarial inputs, evaluates every case with a fresh trusted runner and harness, and reports whether the shifted cases preserve the intended proof-backed result. It records an exposed shift weakness instead of hiding it, and remains a research/robustness report rather than a promotion artifact. This is an independent red-team-shaped evaluation path, not hostile-code isolation or a claim of broad adversarial coverage.

Pending research questions from the latest verified constitutional snapshot or verified agent-run snapshot can enter as `RESEARCH`-sourced historical entries. Completed bounded research outcomes from verified agent-run cycles can enter the same source with coarse completion, audit, winner, and promotion signals. Both forms preserve surprise and prediction-error context under synthetic memory identities; the original task ID, action report, reason, scheduler state, search report, and research-resolution authority are not exposed. Matching snapshots of the same question are deduplicated, while distinct evidence remains distinct. This gives a later bounded planner a reminder of investigation history without turning memory into a research scheduler or a trusted experiment report.

Those source-filtered session summaries can reach a fresh process-isolated planner in the same way as discovery summaries. The planner can use the historical match count as context, but the parent still validates the resulting plan and the fresh runner must earn new proof; a source mismatch produces an ordinary zero-match context rather than hidden access to another archive type.

The same handoff applies to `COORDINATION` summaries: the planner can know that a bounded peer run reached quorum or did not, but it cannot receive the peer messages, member runners, consensus object, or coordination authority.

The same handoff now applies to `ADVERSARIAL_LINEAGE` summaries: a fresh process-isolated planner can receive the bounded fact that a skeptic lineage exposed weaknesses, but only as read-only historical context. The parent still validates the planner output and earns any new proof; the planner cannot receive the adversarial cases, evaluator, harness, action reports, or promotion authority.

The process-boundary check runs a module in a separate Node process with only explicit filesystem-read roots. Network access, filesystem writes, child processes, workers, FFI, and inspector access are denied by default; input, output, and wall-clock time are bounded. The result is plain data and is never a trusted action report or proof. A process-backed selector adapts that data into the ordinary search/promotion path; only the parent-side executor and verifier can produce a fresh `PROVEN` action. This is a real process-and-runtime permission boundary on supported Node versions, but it is not a complete kernel/container boundary: deployments still need OS policy, cgroups, namespaces, seccomp, or a container runtime for hostile code and resource exhaustion.

The model-provider adapter uses that same child-process boundary for natural-language work. A provider can return data-only text with provider/model identity, but the parent records it as `OBSERVED` and the `model-response-observer/v1` verifier includes an explicit failed semantic-proof check. Even a forged response or forged deterministic flag cannot become `PROVEN`; a real deployment still needs a live provider integration, credential policy, semantic evaluation, and independent truth checks.

The tool protocol wraps the same child-process boundary for agent-facing calls. Each registered tool has a stable identity, each call consumes a unique call ID, and completed or failed calls return immutable data-only reports marked `OBSERVED` with `verified: false`. A bounded agent episode may explicitly name one completed tool call as `inputFromToolCall`; that output becomes the next cycle's input, while a failed tool stops the episode before constitutional action admission. Tool results do not become action reports or proof automatically. This is a narrow adapter for bounded tools; it does not grant network access, unrestricted filesystem access, live credentials, or OS-level resource guarantees.

Agent-run ledger entries are orchestration history, not authority. They preserve enough context to understand what a bounded run attempted and why it stopped, but restoration returns frozen plain data and cannot recreate a runner, planner, tool registry, policy brand, action proof, or constitutional authority.

The continuation boundary makes the safe next step explicit. `continueBoundedAgentFromLedger` restores data-only world-model history and the latest bounded policy values, constructs a fresh constitutional core and cycle runner, and requires any tools to be supplied afresh. The new agent can benefit from prior attempts, but starts with zero actions and an empty audit; its next result must earn new verification. This is controlled continuation, not live-core resurrection or automatic trust in archived code.

If the archived context contains a pending research question, `replayResearchHandoff` reconstructs only the task description and input, identifies the archived action by task and action number, and executes a fresh episode. The resulting fresh report can then go through the normal research resolver. The old action remains data-only history; replay is explicitly re-execution, not restoration of proof.

Planner comparison is an evaluation stage with a narrow promotion boundary. A planner candidate must produce a trusted process-isolated planner, its plan must preserve the evaluation task identity, malformed or oversized output becomes a failed case, and only the parent bounded runner can produce action evidence. `AgentPlannerPromotionAuthority` accepts only an independent replay with matching case identity, mode budgets, planner-definition fingerprints, and per-case evidence; adoption returns a fresh planner instance. This is planner eligibility, not an evolution permit, code mutation, or architecture invention.

Architecture search is currently a bounded composition experiment: `AgentArchitectureCandidate` combines one trusted planner candidate, a fresh trusted `AgentPolicy` factory, and a frozen data-only component descriptor. The search runner evaluates each bundle through the existing planner and parent proof path, then ranks the resulting reports. The search stage itself does not alter the constitutional core or claim that a planner-plus-policy bundle is a newly invented cognitive architecture; only the separate replay/adoption path can authorize a fresh candidate.

The architecture proposer is the first parent/child discovery seam. A process-isolated module receives only the goal and registered planner IDs, returns a finite JSON-compatible proposal list, and cannot return trusted planner objects, policies, actions, or proof. The parent validates the proposal, resolves IDs against its trusted registry, constructs fresh policies, and sends the resulting bundles through the ordinary architecture evaluator. Unknown IDs, malformed policy limits, duplicate IDs, and oversized proposal lists fail before evaluation.

Architecture reproducibility is a separate evidence boundary. `AgentArchitectureReproducibilityAuthority` certifies only two complete reports produced by different search runners over the same trusted case objects, mode budgets, bundle identity, architecture fingerprint, and nested per-case evidence. It rejects reused runners, changed suites or budgets, changed definitions, incomplete reports, and forged artifacts. `AgentArchitectureAdoptionAuthority` can consume that certificate only after revalidation, thresholds, and fresh dependency checks, then return a fresh candidate wrapper for another bounded parent evaluation. `AgentArchitectureDiscoveryRunner` composes the process proposer, trusted parent registry, architecture evaluator, replay authority, and adoption authority into one finite transaction. `agentFromAdoptedArchitecture` then builds a fresh planner-plus-`BoundedAgentRunner` pair for one bounded agent runtime. `AgentArchitectureEnsembleRunner` can execute multiple fresh runtimes independently and require a proof quorum. `AgentArchitectureCoordinationRunner` adds only finite parent-mediated summaries between rounds; it does not merge memory, transfer trusted reports, or coordinate autonomous authority. `AgentArchitectureSessionRunner` composes those stages into one supervised, in-memory discovery-to-fresh-agents-to-coordination run. `EvidenceLedger.appendArchitectureCoordination` can preserve that bounded transcript with a chain hash and a content fingerprint, while `EvidenceLedger.appendArchitectureDiscovery` can preserve proposals, candidate definitions, per-mode/per-case outcomes, replay reasons, and adoption status as a separate fingerprinted data-only record. Restoration returns only data-only summaries and cannot recreate the trusted discovery report, candidates, planners, adoption authority, coordination report, or any runtime dependency. Adoption, runtime construction, ensemble execution, coordination, session orchestration, and transcript archiving are operator-controlled bounded handoffs, not autonomous invention, code mutation, constitutional mutation, or deployment.
The `HarnessFactory` façade is the first lifecycle-level assembly line over those authorities. It accepts an optional trusted historical research context, commissions the process-isolated proposer, resolves only registered components, evaluates and independently replays the resulting bundles, archives the detailed discovery record, protects the fresh adopted candidate, retires the evaluated candidates, and returns only a frozen summary of what happened. When an agent task is requested, it also constructs a fresh bounded runtime from the adoption, runs that task through the parent proof path, and archives only a data-only run summary; the live agent and action report never escape the factory report. Its `improve()` path round-trips the factory’s own verified ledger through bounded `ARCHITECTURE_DISCOVERY` memory and gives the next proposer only that historical summary, so every new generation must earn fresh evaluation and adoption again. Each factory archive now carries a generation number, predecessor hash locator, and fingerprint of the benchmark cases/tasks/context plus mode budgets. The factory compares the new winner’s measured production, research, skeptic, transfer, and weakness metrics plus the benchmark contract with the latest verified generation by default; an optional positive `baselineGeneration` selects an older verified generation from the same factory history, allowing a prior benchmark partition to be improved after a newer partition exists. The selected baseline must exist, precede the new archive, and match the current benchmark contract; the global predecessor remains the latest archive so the ledger stays one auditable chain. An adopted candidate that regresses, merely ties, or quietly changes the selected benchmark is rejected before it is archived or exposed, while a rejected attempt remains an explicit data-only outcome. Retirement means the factory will not accept that candidate for another disposal cycle, not that JavaScript can force garbage collection or invalidate an external reference. The factory still does not deploy, mutate source code, invent unregistered primitives, or turn an archive into authority.

`factory.frontier()` and each factory report also expose a bounded Pareto-style frontier of nondominated, same-benchmark generation summaries, reconstructed from verified archives and capped at eight entries. Each frontier report also counts all comparable adopted/rejected generations and their `FAILED`/`NOT_RUN`/`PASSED` holdout dispositions, including failed-to-passed recovery transitions. `factory.frontiers()` groups those frontiers across the archived benchmark contracts, with at most eight benchmark partitions returned. `factory.history()` exposes a capped summary-only timeline of archived generations, including attempts that the frontier pruned. Frontier entries, history generations, and lifecycle reports include a derived holdout status, so the comparison can distinguish benchmark fitness from independently validated holdout coverage; this is comparison evidence, not a deployment or promotion authority.

`factory.recommend()` is a read-only advisory layer over that verified history. It returns a bounded frozen summary with one of four statuses: `RECOVER_FAILED_HOLDOUT`, `VALIDATE_LATEST_HOLDOUT`, `IMPROVE_LATEST_GENERATION`, or `NO_HISTORY`. It prioritizes an unresolved failed holdout, then an unvalidated latest generation, then strict improvement; archived explicit validation records count as verified holdout dispositions without becoming new generations. It does not run a planner, evaluate a candidate, mutate the ledger, or select deployment authority.

`factory.researchAgenda()` is the broader factory research queue. It derives a capped, ranked list from the same verified archives: unresolved holdout recovery, unseen validation, skeptic weaknesses, transfer gaps, and strict improvement. Each item carries only a generation/archive locator, benchmark identity, measured fitness, holdout status, and plain-language reason. The agenda is an experiment backlog, not an executor: it does not invent executable code, run candidates, mutate history, or transfer authority.

`factory.benchmark({ candidate, cases, levels })` is the factory’s bounded architecture benchmarker. It evaluates a fresh candidate at finite budget levels, independently replays each level with fresh search runners, rejects definition drift between levels, and returns summary metrics plus a compute/fitness Pareto frontier. The candidate, search reports, runners, and action evidence remain private; the benchmark does not adopt, deploy, or archive the candidate.

`factory.benchmarkCampaign({ candidates, cases, levels })` compares a bounded set of fresh candidates over the same finite budget ladder. Each level gets one fresh multi-candidate search runner and one fresh reproduction runner, every candidate must keep a stable definition across levels, and the result exposes only candidate/level fitness points plus a cross-candidate compute/fitness Pareto frontier. Shared planner or policy definitions, retired candidates, and incomplete input contracts fail closed; the campaign does not adopt or deploy any candidate. `factory.archiveBenchmarkCampaign(campaign)` is the separate operator-controlled persistence step: it stores only the hash-chained data-only summaries and `ledger.restoreHarnessFactoryBenchmarkCampaigns()` returns plain evidence without candidates, runners, reports, or authority.

`factory.benchmarkCampaigns()` is the corresponding read-only factory view over those archived campaigns. It verifies the current ledger, filters records to the exact factory, returns at most 32 archive summaries, and exposes no live candidates, runners, reports, or authority; it is historical comparison evidence only. Campaign records can also be imported into structured memory under `MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN`; `factory.improve()` may query that source, giving a process-isolated proposer a read-only campaign signal before the fresh strict-improvement and proof gates run again.

`factory.benchmarkCampaignValidations()` is the read-only companion history for archived campaign rechecks. It verifies the current ledger, filters validation records to the exact factory, returns at most 32 frozen pass/fail summaries in archive order, and exposes only benchmark/holdout evidence and locators; candidates, evaluators, runners, action reports, deployment, and authority never cross this boundary.

Archived campaign validations can also be imported into structured memory under `MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION`. Failed and passed rechecks are labeled separately, retain only their candidate/level and bounded outcome signals plus ledger provenance, and may be queried by `factory.improve()` as a historical research signal. The proposer still receives no evaluator artifacts, and the next candidate must pass the normal fresh benchmark, reproduction, skeptic, strict-improvement, and proof gates.

`factory.benchmarkValidationScorecard()` aggregates the latest bounded validation window by candidate. It reports pass/fail counts, pass rate, completion/reproducibility/independence counts, and the latest validation locators, making repeated generalization behavior comparable without exposing a live architecture or turning the scorecard into promotion authority.

`factory.benchmarkValidationStability()` adds a stricter longitudinal view. It groups the same bounded validation window by candidate and architecture fingerprint, counts distinct archived campaign runs, and marks a configuration `STABLE` only when at least two separate campaigns all pass with complete, reproducible, independent evidence. A single campaign is `INSUFFICIENT`; repeated evidence containing a failure or incomplete/non-independent result is `UNSTABLE`. This separates a one-off recovery from repeatable evidence without promoting or deploying the architecture.

`factory.validateBenchmarkCampaignFrontier({ campaign, points, cases, holdoutCases, ... })` validates every archived nondominated campaign point in one bounded batch. Each point needs a fresh matching candidate, the original benchmark suite is replayed with fresh evaluators, and a disjoint holdout is checked before the result can be archived. `factory.archiveBenchmarkCampaignFrontierValidations(batch)` persists the child validation records as hash-chained data-only evidence; the batch cannot adopt, deploy, restore, or transfer runtime authority.

`factory.benchmarkFrontierValidationScorecard()` gives a capped, read-only view of those archived frontier checks grouped by source campaign. It reports frontier coverage, missing points, duplicate attempts, latest pass/fail status, and whether the complete frontier has repeatable independent evidence; it uses the latest archived result for each point and never restores candidates, evaluators, or authority.

An unresolved failed campaign validation now appears in `factory.researchAgenda()` as the highest-priority `INVESTIGATE_BENCHMARK_VALIDATION` target. The item carries only the candidate/level, benchmark identity, bounded replay and holdout evidence, and archive locators; a later pass for the same campaign frontier point suppresses the stale failure target. The agenda remains a research queue and does not execute or promote anything.

`factory.executeBenchmarkValidationResearch(target, options)` is the bounded execution bridge for that target. The operator must supply the exact agenda item, a currently trusted archived campaign report, a freshly reconstructed candidate, the matching benchmark suite, and a disjoint holdout suite; the factory replays the archived frontier point with fresh evaluators, archives the new pass/fail validation, and returns only a data-only validation summary. It rejects forged, foreign, proxied, stale, mismatched, mutable, or non-validation targets before archive mutation. It never adopts, deploys, restores archived runtime artifacts, or transfers authority.

For the actionable `RECOVER_FAILED_HOLDOUT` and `IMPROVE_LATEST_GENERATION` statuses, `factory.executeRecommendation(recommendation, options)` is an operator-supplied bridge: the caller still provides fresh planner candidates, benchmark cases, budgets, and any holdout suite. The factory binds execution to the exact current recommendation, requires durable archival, and routes through the normal fresh `improve()` gates; forged, foreign, stale, mutable, mismatched, or incomplete requests fail before archive mutation. For `VALIDATE_LATEST_HOLDOUT`, `factory.validateRecommendation(recommendation, options)` accepts an explicitly reconstructed fresh candidate, checks its components, planner identity, and evaluated architecture fingerprint against the archived summary, runs a disjoint holdout with fresh evaluators, and returns pass/fail evidence without adoption or archival mutation. `factory.archiveValidation(validation)` is the separate operator-controlled persistence step: it appends a distinct hash-chained `harness-factory-validation` record containing only the baseline locator, architecture fingerprint, and bounded holdout summary. A passed archived validation changes the next recommendation to improvement; a failed one changes it to recovery. It does not create a generation, adopt a candidate, or restore runtime authority. Retired archive summaries still never restore a live candidate automatically.

An optional `holdoutCases` list gives the adopted bundle an unseen benchmark after the normal discovery/adoption transaction. The factory evaluates that bundle with fresh search runners, independently replays the holdout, requires every production-eligible case to succeed and meet its proof obligation, and stores the disposition as bounded data-only factory metadata when archival is enabled: a pass is archived as an adopted generation, while a failed holdout is archived as a rejected generation only after its evaluated candidates are retired. Holdout cases are capped and must be trusted and disjoint from the discovery suite. Passing and failing dispositions become bounded `holdout-passed` or `holdout-failed` historical keywords for the next process-isolated proposer; no holdout inputs, runners, or action reports cross that memory boundary, and the failed candidate is never exposed. Holdout validation is still bounded evaluation, not proof of generalization.

Custom world-model telemetry remains replaceable, but it cannot upgrade verification: even a model that reports low surprise and a forged proven profile leaves a resource-limited action as `OBSERVED`, keeps the question policy in research mode, and fails proof-required evaluation.

World-model predictions, profiles, and observations are copied into data-only snapshots at the harness boundary. Inherited accessors or later changes inside a custom model cannot rewrite the prediction or learning metadata retained by a trusted report, and predictions must identify the selected reasoning engine.

Structured predictions and observations are compared by value, including nested arrays and objects, so a freshly observed object with the same contents is not incorrectly treated as a surprising mismatch.

Structured expected observations are copied deeply as well, so a frozen outer prediction cannot retain a mutable or accessor-backed nested value.

Measured learning signals are checked too: their prediction flag, finite non-negative surprise, surprise band, strategy key, and observed outcome must be valid and match the current action before learning or reporting proceeds.

The signal check also binds the prediction error, expected and observed likelihoods, surprise value, and surprise band to the snapshotted prediction and observation. A replaceable model can improve forecasting, but it cannot rewrite telemetry to hide an inconsistency or suppress the curiosity trigger.

World-model observations are data-only values: functions, symbols, and bigints are rejected at both the root and nested snapshot boundaries.

The high-surprise threshold remains explicit model configuration for a direct harness, and the harness validates the signal against it. A constitutional core adds the operator-controlled `Constitution.maxSurpriseThreshold` ceiling: it rejects a model threshold above that ceiling at construction, planning, or execution, including after a model replacement. The model may choose a lower threshold and become more cautious, but it cannot raise the ceiling to suppress research questions.

That ceiling is snapshotted into each trusted plan, so a model that changes its threshold during execution cannot silently relabel the resulting signal. This is a constitutional-core guarantee, not a claim that every extension is sandboxed or trustworthy. Direct `FluidHarness` use remains an experimental in-process path, and custom selectors, world models, executors, and verifiers are still extension points. The harness checks their ownership, provenance, and consistency where it can; deployments that load genuinely untrusted code still need a separate process or OS-level resource boundary and explicit operator policy.

The failure demo supplies malformed graph input. The executor error is still rethrown to the caller, but the world model also records an `OBSERVED` high-surprise failure with a failure count, so repeated failures can lower future prediction confidence.

If failure learning itself fails, the harness still rethrows the original execution or verification error and exposes the secondary diagnostic as `lastFailureLearningError`.

Manual `FluidHarness.record()` calls are observational only and reject trusted verification objects from prior executions; proof-carrying reports are produced by `execute()` after the current execution is independently verified. Trusted action reports carry an immutable input snapshot, are checked against the exact plan and input currently being executed, and are single-use within a constitutional core, so a same-harness report cannot be replayed for another task plan, case input, or action. Trusted execution artifacts are bound to their producing executor registry and checked against the requested task, strategy, and normalized input; the harness also consumes each execution once, so a registry override cannot replay an execution from a prior call or hide reuse behind a fresh action report. Trusted verification artifacts are bound to the execution they verify, so even a custom verifier cannot replay a proof from another execution. Direct cycle reports likewise require a plan and action report owned by the supplied constitutional core, and their question decision must come from that action.

Action reports also refuse borrowed verification metadata unless it is paired with the current trusted execution and matching task, strategy, normalized input, observation, and result. Complete cycle reports likewise require the question decision to have been committed to the owning core's audit chain.

Harness admission uses a factory brand rather than `instanceof`: legitimate `FluidHarness` subclasses remain usable for controlled custom executors, while prototype-only spoofs and proxies cannot enter constitutional, evaluation, or scaling boundaries.

Cognitive cycle entry points require a factory-trusted, exact constitutional core instance. Derived cores and proxies cannot override ownership or audit methods and then present delegated artifacts as a trusted cycle.

Promotion authorities use the same exact-instance rule. A derived or proxied authority cannot replace the research and skeptic policy with an overriding promotion decision, and search rejects one before candidate evaluation begins.

Trusted orchestration and built-in dependency prototypes are frozen after module initialization, so one candidate cannot replace shared evaluation, promotion, constitutional, search, harness, selector, executor, verifier, world-model, cycle, scaling, or mutation methods in-process. Harness instances snapshot their resolved methods first, preserving controlled per-instance overrides and subclass extension. User-supplied selectors, executors, verifiers, and world models remain replaceable objects. This protects the trusted kernel from ordinary prototype tampering; it is not an OS sandbox for genuinely hostile code.

Trusted type checks also use captured language intrinsics rather than live `instanceof` behavior, so a candidate changing `Function.prototype[Symbol.hasInstance]` cannot make valid evaluation reports fail or alter the kernel's type decisions.

Constitutional limits are factory-trusted as well. A plain object that merely inherits from `Constitution`, or a derived/proxied constitution, cannot supply mutable or spoofed resource limits to a core or representation search.

Question audits are also core-owned: an action performed directly by a harness before it belongs to a constitutional core cannot later be presented as that core's current action. The core must have admitted and recorded the action before it can record the associated question.

Question audits also preserve policy provenance: a question attached to a research action cannot be relabeled as production (or vice versa) when it is written to the constitutional audit chain.

## Layout

- `src/representation.mjs` — task, representation, strategy, and engine selection
- `src/executor.mjs` — registered deterministic graph, constraint, array, bounded database-query, finite theorem, finite Bayesian, finite-state simulation, finite optimizer, bounded search-tree, and finite program-synthesis executors
- `src/world-model.mjs` — prediction, observation, surprise measurement, and strategy profiles
- `src/action.mjs` — proof-carrying action reports
- `src/verification.mjs` — independent graph/constraint/array/database-query/theorem/Bayesian/simulation/optimization/search-tree/program-synthesis verification and environment hashing
- `src/model-provider.mjs` — process-isolated natural-language provider adapter and observed-only model executor
- `src/evaluation.mjs` — production/research evaluation, transfer metrics, and promotion authority
- `src/scaling.mjs` — measured compute-budget curves and Pareto-frontier analysis
- `src/agent-architecture-scaling.mjs` — fresh session fan-out/round scaling curves and Pareto-frontier analysis
- `src/constitution.mjs` — immutable limits, audit chain, policy boundary, and shutdown control
- `src/search.mjs` — isolated representation candidates, transfer ranking, promotion, and safe adoption
- `src/evolution.mjs` — sequential mutation levels, reproducible permits, and bounded policy applications
- `src/cycle.mjs` — full cognitive-cycle orchestration and immutable stage reports
- `src/curiosity.mjs` — surprise/evidence question policy and research escalation decisions
- `src/research-scheduler.mjs` — bounded data-only prioritization of pending research handoffs
- `src/agent.mjs` — bounded multi-episode agent loop, tool handoffs, scheduled research handoffs, and finite research-batch receipts
- `src/memory.mjs` — bounded structured-memory entries, deterministic source/filter retrieval, read-only ledger provenance, data-only agent-run/ledger, architecture-discovery, adversarial-lineage and ensemble, memory-aware ensemble, coordination, session, and research import, and read-only planner-context handoff
- `src/adversarial-lineage.mjs` — finite fresh skeptic-lineage evaluation with summary-only weakness reporting and no production authority
- `src/adversarial-lineage-ensemble.mjs` — bounded repetition of one skeptic suite across fresh lineage runners with aggregate weakness metrics
- `src/verifier-correlation.mjs` — per-case verifier-family correlation audit over skeptic ensembles, with unresolved-coverage and authority boundaries
- `src/distribution-shift.mjs` — finite same-task, changed-input robustness evaluation with fresh per-case dependencies and explicit weakness reporting
- `src/evidence-ledger.mjs` — append-only, hash-chained action/cycle/core/agent-run/adversarial-lineage/ensemble/distribution-shift/memory-aware-ensemble/architecture-discovery/coordination/session and memory-aware-transcript evidence archive boundary
- `src/memory-agent.mjs` — fresh memory-aware bounded-agent composition, summary-only research receipts, and no restored authority
- `src/memory-agent-ensemble.mjs` — independent fresh memory-aware runtimes with bounded summary-only proof quorum and parent-indexed read-only context
- `src/memory-agent-coordination.mjs` — finite parent-mediated memory-aware rounds with fresh ledger-backed agents, peer summaries, and data-only consensus counts
- `src/memory-agent-session.mjs` — supervised discovery-to-memory-aware-coordination composition with summary-only output
- `src/memory-agent-scaling.mjs` — finite memory-aware session scaling with fresh dependencies, data-only Pareto metrics, and explicit failure points
- `src/harness.mjs` — orchestration of the kernel cycle
- `test/harness.test.mjs` — behavioral contract tests
- `GATES.md` — executable acceptance ledger
- `SCOPE_MATRIX.md` — traceability from the master plan to current and future scope
- `src/process-boundary.mjs` — permission-limited child-process runner for untrusted module outputs
- `src/tool.mjs` — process-isolated tool definitions, registry, and observed invocation reports
- `src/agent-plan.mjs` — bounded process-isolated planner output and episode-plan validation
- `src/agent-search.mjs` — process-isolated planner candidates and finite multi-mode comparison
- `src/agent-architecture.mjs` — bounded planner-plus-policy architecture bundles and evaluation-only ranking
- `src/agent-architecture-proposal.mjs` — process-isolated data-only architecture proposals and parent registry resolution
- `src/agent-architecture-discovery.mjs` — bounded proposal-to-replay-to-adoption architecture discovery transaction
- `src/harness-factory.mjs` — lifecycle façade for research intake, architecture manufacture, archive, and candidate retirement
- `src/agent-architecture-runtime.mjs` — fresh bounded agent construction from adopted architecture evidence
- `src/agent-architecture-ensemble.mjs` — independent adopted-agent execution and proof-quorum reporting
- `src/agent-architecture-coordination.mjs` — finite parent-mediated data-only summary exchange between rounds
- `src/agent-architecture-session.mjs` — supervised discovery-to-fresh-agents-to-coordination composition
- `src/agent-continuation.mjs` — fresh-agent construction from data-only ledger history
