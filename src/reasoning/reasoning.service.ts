import { Injectable } from '@nestjs/common';
import { TransactionMatcherService } from './transaction-matcher.service';
import { EvidenceAnalyzerService } from './evidence-analyzer.service';
import { ClassifierService } from './classifier.service';
import { AnalyzeTicketRequestDto } from '../ticket/dto/analyze-ticket-request.dto';
import {
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
} from '../common/enums/taxonomy';
import { LlmService } from '../llm/llm.service';
import { SafetyGuardrailService } from '../safety/safety-guardrail.service';

export interface ReasoningResult {
  relevant_transaction_id: string | null;
  evidence_verdict: EvidenceVerdict;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  human_review_required: boolean;
  confidence: number;
  reason_codes: string[];
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
}

@Injectable()
export class ReasoningService {
  constructor(
    private readonly transactionMatcher: TransactionMatcherService,
    private readonly evidenceAnalyzer: EvidenceAnalyzerService,
    private readonly classifier: ClassifierService,
    private readonly llmService: LlmService,
    private readonly safetyGuardrailService: SafetyGuardrailService,
  ) {}

  analyze(request: AnalyzeTicketRequestDto): ReasoningResult {
    const { transaction_history, user_type, language, ticket_id } = request;

    // Step 0: Check Prompt Injection
    const safetyCheck = this.safetyGuardrailService.checkPromptInjection(
      request.complaint,
    );
    const complaint = safetyCheck.safeComplaint;

    const history = transaction_history || [];

    // Step 1: Match Transaction
    const matchResult = this.transactionMatcher.matchTransaction(
      complaint,
      history,
    );
    const matchedTxn = matchResult
      ? history.find((t) => t.transaction_id === matchResult.transactionId) ||
        null
      : null;

    // Step 2: Analyze Evidence
    const evidenceVerdict = this.evidenceAnalyzer.analyzeEvidence(
      complaint,
      matchedTxn,
      history,
    );

    // Step 3: Classify
    const classification = this.classifier.classify({
      complaint,
      userType: user_type,
      evidenceVerdict,
      matchedTxn,
    });

    // Step 4: Generate text output (template-based, no LLM call)
    const llmOutput = this.llmService.generateAnalysis({
      complaint,
      matchedTxn,
      evidenceVerdict,
      caseType: classification.case_type,
      severity: classification.severity,
      language,
      ticketId: ticket_id,
    });

    // Step 5: Post-process Output with Safety Guardrails
    const safeOutput = this.safetyGuardrailService.sanitize(
      llmOutput.agent_summary,
      llmOutput.recommended_next_action,
      llmOutput.customer_reply,
    );

    // Step 6: Return Result
    return {
      relevant_transaction_id: matchedTxn ? matchedTxn.transaction_id : null,
      evidence_verdict: evidenceVerdict,
      case_type: classification.case_type,
      severity: classification.severity,
      department: classification.department,
      human_review_required:
        classification.human_review_required ||
        safetyCheck.isInjection ||
        safeOutput.modified,
      confidence: classification.confidence,
      reason_codes: classification.reason_codes,
      agent_summary: safeOutput.agentSummary,
      recommended_next_action: safeOutput.recommendedNextAction,
      customer_reply: safeOutput.customerReply,
    };
  }
}
