import {
  Constitution,
  ConstitutionalCore,
  isTrustedConstitutionalCore
} from './constitution.mjs';
import { isTrustedQuestionDecision, questionFor } from './curiosity.mjs';
import { POLICY_MODES } from './evaluation.mjs';
import {
  isCompleteSearchReport,
  isTrustedSearchRunner,
  RepresentationSearchRunner
} from './search.mjs';
import {
  isFrozenObject,
  isInstanceOf,
  objectFreeze,
  objectGetPrototypeOf,
  stringTrim,
  weakSetCreate,
  weakSetAdd,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_CYCLE_REPORTS = weakSetCreate();
const TRUSTED_CYCLE_RUNNERS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function stage(value) {
  return objectFreeze(value);
}

export class CognitiveCycleReport {
  constructor({ plan, actionReport, core, researchReport = null, questionDecision = null }) {
    if (!plan || !actionReport || !isTrustedConstitutionalCore(core)) {
      throw new TypeError('CognitiveCycleReport requires a plan, action report, and core');
    }
    if (!core.ownsPlan(plan) || !core.ownsActionReport(actionReport)) {
      throw new TypeError('CognitiveCycleReport requires a plan and action report owned by the supplied core');
    }
    if (actionReport.taskId !== plan.task.id) {
      throw new Error('CognitiveCycleReport plan and action report tasks must match');
    }
    if (!core.ownsActionReport(actionReport, plan)) {
      throw new TypeError('CognitiveCycleReport requires an action report matching the supplied plan');
    }
    if (researchReport !== null && !isCompleteSearchReport(researchReport)) {
      throw new TypeError('CognitiveCycleReport research must be a complete trusted search report');
    }
    const question = questionDecision ?? questionFor({
      actionReport,
      researchCompleted: researchReport !== null
    });
    if (!isTrustedQuestionDecision(question, actionReport)) {
      throw new TypeError('CognitiveCycleReport question must be trusted for the action report');
    }
    if (question.researchCompleted !== (researchReport !== null)) {
      throw new Error('CognitiveCycleReport question researchCompleted must match the research report');
    }
    if (!core.ownsQuestionDecision(question, actionReport)) {
      throw new TypeError('CognitiveCycleReport question must be recorded by the supplied core');
    }

    this.taskId = plan.task.id;
    this.actionNumber = core.status.actionsUsed;
    this.action = actionReport;
    this.research = researchReport;
    this.questionDecision = question;
    this.stages = objectFreeze({
      understand: stage({
        taskId: plan.task.id,
        description: plan.task.description
      }),
      represent: stage({
        representation: plan.strategy.representation,
        reasoningEngine: plan.strategy.reasoningEngine,
        executionSubstrate: plan.strategy.executionSubstrate,
        confidence: plan.strategy.selectionConfidence,
        ambiguous: plan.strategy.selectionAmbiguous
      }),
      predict: stage({
        expectedObservation: plan.prediction.expectedObservation,
        expectedLikelihood: plan.prediction.expectedLikelihood,
        strategyKey: plan.prediction.strategyKey,
        strategyProfile: plan.strategyProfile
      }),
      act: stage({
        observation: actionReport.observation.actualObservation,
        result: actionReport.result
      }),
      learn: stage({
        strategyKey: actionReport.prediction.strategyKey,
        predictionError: actionReport.predictionError,
        surpriseNats: actionReport.surpriseNats,
        surpriseBand: actionReport.surpriseBand,
        worldModelHistoryLength: core.learningHistory.length,
        priorStrategyProfile: actionReport.priorStrategyProfile,
        strategyProfile: actionReport.strategyProfile
      }),
      verify: stage({
        evidence: actionReport.evidence,
        invariantsChecked: actionReport.invariantsChecked,
        verifierId: actionReport.verification?.verifierId ?? null,
        environmentHash: actionReport.environmentHash
      }),
      question: stage({
        requested: question.requested,
        reason: question.reason,
        automatic: question.automatic,
        researchRequested: question.researchRequested,
        researchCompleted: question.researchCompleted,
        researchRequired: question.researchRequired,
        evidence: question.evidence,
        surpriseBand: question.surpriseBand,
        candidateCount: researchReport?.results.length ?? 0,
        winner: researchReport?.winner.candidateId ?? null,
        promoted: researchReport?.promoted?.candidateId ?? null,
        allAuditsValid: researchReport?.allAuditsValid ?? true
      }),
      preserve: stage({
        coreAuditValid: core.verifyAudit(),
        researchAuditValid: researchReport?.allAuditsValid ?? true,
        promotedCandidate: researchReport?.promoted?.candidateId ?? null,
        productionPreserved: true
      })
    });
    this.coreStatus = core.status;
    objectFreeze(this);
  }
}

export function isTrustedCycleReport(report) {
  return typeof report === 'object'
    && report !== null
    && isFrozenObject(report)
    && weakSetHas(TRUSTED_CYCLE_REPORTS, report);
}

export class CognitiveCycleRunner {
  constructor({
    core = new ConstitutionalCore({ constitution: new Constitution() }),
    searchRunner = new RepresentationSearchRunner()
  } = {}) {
    if (!isTrustedConstitutionalCore(core)) {
      throw new TypeError('CognitiveCycleRunner requires a trusted ConstitutionalCore');
    }
    if (!isTrustedSearchRunner(searchRunner)) {
      throw new TypeError(
        'CognitiveCycleRunner requires a RepresentationSearchRunner; a trusted instance is required'
      );
    }
    this.core = core;
    this.searchRunner = searchRunner;
    weakSetAdd(TRUSTED_CYCLE_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    task,
    input,
    policyMode = POLICY_MODES.PRODUCTION,
    reproduction = 'CognitiveCycleRunner.run',
    executionOptions = {},
    research = null
  }) {
    const normalizedReproduction = requireNonEmptyString(reproduction, 'Cycle reproduction');
    const plan = this.core.plan(task);
    if (!this.core.canAppendAudit(3)) {
      throw new RangeError('Cognitive cycle requires three available audit entries');
    }
    const actionReport = this.core.execute({
      plan,
      input,
      policyMode,
      reproduction: normalizedReproduction,
      executionOptions
    });
    let researchReport = null;
    if (research !== null) {
      try {
        researchReport = this.searchRunner.evaluate(research);
        if (!isCompleteSearchReport(researchReport)) {
          throw new TypeError('CognitiveCycleRunner research must be a complete trusted search report');
        }
      } catch (error) {
        const unresolvedQuestion = questionFor({
          actionReport,
          researchRequested: true
        });
        try {
          this.core.recordQuestion({
            taskId: plan.task.id,
            policyMode,
            question: unresolvedQuestion,
            actionReport,
            researchReport: null
          });
        } catch (questionError) {
          if (isInstanceOf(error, Error) && !('cause' in error)) {
            error.cause = questionError;
          }
        }
        throw error;
      }
    }
    const questionDecision = questionFor({
      actionReport,
      researchCompleted: researchReport !== null
    });
    this.core.recordQuestion({
      taskId: plan.task.id,
      policyMode,
      question: questionDecision,
      actionReport,
      researchReport
    });
    const cycle = new CognitiveCycleReport({
      plan,
      actionReport,
      core: this.core,
      researchReport,
      questionDecision
    });
    weakSetAdd(TRUSTED_CYCLE_REPORTS, cycle);
    return cycle;
  }
}

objectFreeze(CognitiveCycleRunner.prototype);

export function isTrustedCycleRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_CYCLE_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === CognitiveCycleRunner.prototype;
}
