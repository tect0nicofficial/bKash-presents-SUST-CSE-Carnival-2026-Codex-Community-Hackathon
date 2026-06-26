import { Injectable, Logger } from '@nestjs/common';
import { EvidenceVerdict, CaseType, Severity } from '../common/enums/taxonomy';
import { TransactionHistoryEntryDto } from '../ticket/dto/transaction-history-entry.dto';

export interface LLMOutput {
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
}

export interface TemplateContext {
  complaint: string;
  matchedTxn: TransactionHistoryEntryDto | null;
  evidenceVerdict: EvidenceVerdict;
  caseType: CaseType;
  severity: Severity;
  language?: string;
  ticketId: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  generateAnalysis(context: TemplateContext): LLMOutput {
    this.logger.debug('Generating analysis from templates (rule-based)');
    return {
      agent_summary: this.buildSummary(context),
      recommended_next_action: this.buildNextAction(context),
      customer_reply: this.buildCustomerReply(context),
    };
  }

  private buildSummary(ctx: TemplateContext): string {
    const txn = ctx.matchedTxn;
    if (!txn) {
      if (ctx.caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) {
        return 'Customer reports an unsolicited call or message requesting sensitive credentials. Likely social engineering attempt. Customer has not yet shared any credentials.';
      }
      if (ctx.caseType === CaseType.OTHER) {
        return `Customer reports: "${ctx.complaint.substring(0, 120)}". Insufficient detail to identify a specific transaction.`;
      }
      return `Customer complaint received. No matching transaction found in the provided history. Case requires further investigation.`;
    }

    const amt = txn.amount;
    const txnId = txn.transaction_id;
    const cp = txn.counterparty;
    const status = txn.status;

    switch (ctx.caseType) {
      case CaseType.WRONG_TRANSFER:
        return `Customer reports sending ${amt} BDT via ${txnId} to ${cp}, which they believe was the wrong recipient. Transaction status: ${status}.`;
      case CaseType.PAYMENT_FAILED:
        return `Customer attempted a ${amt} BDT payment (${txnId}) to ${cp} which failed, but reports balance was deducted. Requires payments operations investigation.`;
      case CaseType.REFUND_REQUEST:
        return `Customer requests refund of ${amt} BDT for ${txnId} (payment to ${cp}). Case type: refund request.`;
      case CaseType.DUPLICATE_PAYMENT:
        return `Customer reports possible duplicate payment. Transaction ${txnId} for ${amt} BDT to ${cp} appears to have been charged more than once.`;
      case CaseType.MERCHANT_SETTLEMENT_DELAY:
        return `Merchant reports settlement of ${amt} BDT (${txnId}) is delayed beyond expected window. Settlement status: ${status}.`;
      case CaseType.AGENT_CASH_IN_ISSUE:
        return `Customer reports ${amt} BDT cash-in via ${txnId} not reflected in balance. Transaction status: ${status}. Agent counterparty: ${cp}.`;
      default:
        return `Customer complaint received regarding transaction ${txnId} for ${amt} BDT. Evidence verdict: ${ctx.evidenceVerdict}.`;
    }
  }

  private buildNextAction(ctx: TemplateContext): string {
    const txn = ctx.matchedTxn;

    if (ctx.caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) {
      return 'Escalate to fraud_risk team immediately. Confirm to customer that the company never asks for OTP. Log the reported number for fraud pattern analysis.';
    }

    if (ctx.evidenceVerdict === EvidenceVerdict.INCONSISTENT) {
      return `Flag for human review. Verify with the customer whether the complaint is accurate given the transaction history patterns.`;
    }

    if (ctx.evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA) {
      return 'Reply to customer asking for specific details: transaction ID, amount, description of what went wrong, and approximate time.';
    }

    if (!txn) {
      return 'Reply to customer requesting more details to identify the relevant transaction.';
    }

    switch (ctx.caseType) {
      case CaseType.WRONG_TRANSFER:
        return `Verify ${txn.transaction_id} details with the customer and initiate the wrong-transfer dispute workflow per policy.`;
      case CaseType.PAYMENT_FAILED:
        return `Investigate ${txn.transaction_id} ledger status. If balance was deducted on a failed payment, initiate the automatic reversal flow within standard SLA.`;
      case CaseType.REFUND_REQUEST:
        return "Inform the customer that refund eligibility depends on the merchant's own policy. Provide guidance on contacting the merchant directly.";
      case CaseType.DUPLICATE_PAYMENT:
        return `Verify the duplicate with payments_ops. If the biller confirms only one payment was received, initiate reversal of ${txn.transaction_id}.`;
      case CaseType.MERCHANT_SETTLEMENT_DELAY:
        return 'Route to merchant_operations to verify settlement batch status. If the batch is delayed, communicate a revised ETA to the merchant.';
      case CaseType.AGENT_CASH_IN_ISSUE:
        return `Investigate ${txn.transaction_id} pending status with agent operations. Confirm settlement state and resolve within the standard cash-in SLA.`;
      default:
        return 'Review the transaction details and respond to the customer with findings.';
    }
  }

  private buildCustomerReply(ctx: TemplateContext): string {
    const isBn = ctx.language === 'bn';

    if (isBn) {
      return this.buildBnReply(ctx);
    }

    const txn = ctx.matchedTxn;
    const txnRef = txn ? ` transaction ${txn.transaction_id}` : '';
    const safetySuffix = ' Please do not share your PIN or OTP with anyone.';

    if (ctx.caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) {
      return `Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud team has been notified of this incident.`;
    }

    if (
      ctx.caseType === CaseType.OTHER &&
      ctx.evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA
    ) {
      return `Thank you for reaching out. To help you faster, please share the transaction ID, the amount involved, and a short description of what went wrong.${safetySuffix}`;
    }

    if (ctx.evidenceVerdict === EvidenceVerdict.INCONSISTENT) {
      return `We have received your request regarding${txnRef}. Our dispute team will review the case carefully and contact you through official support channels.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.REFUND_REQUEST) {
      return `Thank you for reaching out. Refunds for completed merchant payments depend on the merchant's own policy. We recommend contacting the merchant directly. If you need help reaching them, please reply and we will guide you.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.WRONG_TRANSFER) {
      return `We have noted your concern about${txnRef}. Our dispute team will review the case and contact you through official support channels.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.PAYMENT_FAILED) {
      return `We have noted that${txnRef} may have caused an unexpected balance deduction. Our payments team will review the case and any eligible amount will be returned through official channels.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.DUPLICATE_PAYMENT) {
      return `We have noted the possible duplicate payment for${txnRef}. Our payments team will verify and any eligible amount will be returned through official channels.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.MERCHANT_SETTLEMENT_DELAY) {
      return `We have noted your concern about settlement${txnRef}. Our merchant operations team will check the batch status and update you on the expected settlement time through official channels.${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.AGENT_CASH_IN_ISSUE) {
      return `We have noted your concern about${txnRef}. Our agent operations team will review the case and contact you through official support channels.${safetySuffix}`;
    }

    return `Thank you for reaching out. We have received your case and will review it shortly.${safetySuffix}`;
  }

  private buildBnReply(ctx: TemplateContext): string {
    const txn = ctx.matchedTxn;
    const txnRef = txn ? ` লেনদেন ${txn.transaction_id}` : '';
    const safetySuffix =
      ' অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।';

    if (ctx.caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) {
      return `তথ্য শেয়ার করার আগে যোগাযোগ করার জন্য ধন্যবাদ। আমরা কখনই আপনার পিন, ওটিপি বা পাসওয়ার্ড চাই না। অনুগ্রহ করে এগুলো কারো সাথে শেয়ার করবেন না, এমনকি তারা আমাদের প্রতিনিধি বললেও। আমাদের ফ্রাড টিমকে এই ঘটনা সম্পর্কে জানানো হয়েছে।`;
    }

    if (
      ctx.caseType === CaseType.OTHER &&
      ctx.evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA
    ) {
      return `যোগাযোগ করার জন্য ধন্যবাদ। আমরা আপনাকে দ্রুত সাহায্য করতে পারতে হলে, অনুগ্রহ করে লেনদেন আইডি, পরিমাণ, এবং কী ভুল হয়েছে সে সম্পর্কে একটি সংক্ষিপ্ত বিবরণ দিন।${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.WRONG_TRANSFER) {
      return `আমরা${txnRef} সম্পর্কে আপনার উদ্বেগ লিপিবদ্ধ করেছি। আমাদের বিবাদ দল কেসটি পর্যালোচনা করবে এবং অফিসিয়াল সাপোর্ট চ্যানেলের মাধ্যমে আপনার সাথে যোগাযোগ করবে।${safetySuffix}`;
    }

    if (ctx.caseType === CaseType.PAYMENT_FAILED) {
      return `আমরা লিপিবদ্ধ করেছি যে${txnRef} একটি অপ্রত্যাশিত ব্যালেন্স কাটা হতে পারে। আমাদের পেমেন্টস টিম কেসটি পর্যালোচনা করবে এবং যোগ্য পরিমাণ অফিসিয়াল চ্যানেলের মাধ্যমে ফেরত দেওয়া হবে।${safetySuffix}`;
    }

    return `ধন্যবাদ${txnRef} সম্পর্কে আপনার উদ্বেগ লিপিবদ্ধ করা হয়েছে। আমাদের দল কেসটি পর্যালোচনা করবে এবং অফিসিয়াল চ্যানেলের মাধ্যমে আপনার সাথে যোগাযোগ করবে।${safetySuffix}`;
  }
}
