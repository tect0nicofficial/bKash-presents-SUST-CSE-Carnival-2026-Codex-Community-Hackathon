import { Injectable } from '@nestjs/common';
import {
  CaseType,
  Severity,
  Department,
  EvidenceVerdict,
  UserType,
  TransactionType,
} from '../common/enums/taxonomy';
import { TransactionHistoryEntryDto } from '../ticket/dto/transaction-history-entry.dto';

export interface ClassifyInput {
  complaint: string;
  userType?: UserType;
  evidenceVerdict: EvidenceVerdict;
  matchedTxn: TransactionHistoryEntryDto | null;
}

export interface ClassifyOutput {
  case_type: CaseType;
  severity: Severity;
  department: Department;
  human_review_required: boolean;
  confidence: number;
  reason_codes: string[];
}

@Injectable()
export class ClassifierService {
  classify(input: ClassifyInput): ClassifyOutput {
    const { complaint, userType, evidenceVerdict, matchedTxn } = input;
    const complaintLower = complaint.toLowerCase();

    // 1. Determine case_type
    let caseType = CaseType.OTHER;

    const hasAnyKeyword = (keywords: string[]) =>
      keywords.some((kw) => complaintLower.includes(kw));

    if (
      hasAnyKeyword([
        'otp',
        'pin called me',
        'phishing',
        'scam',
        'someone called',
        'password',
        'ওটিপি',
        'পিন',
        'পাসওয়ার্ড',
        'জালিয়াতি',
        'প্রতারণা',
      ])
    ) {
      caseType = CaseType.PHISHING_OR_SOCIAL_ENGINEERING;
    } else if (
      hasAnyKeyword([
        'wrong number',
        'wrong person',
        'sent to wrong',
        "didn't get",
        'not received',
        "hasn't received",
        'says he didn',
        'says she didn',
        "doesn't have",
        "didn't receive",
      ])
    ) {
      caseType = CaseType.WRONG_TRANSFER;
    } else if (
      hasAnyKeyword([
        'failed',
        'balance deducted',
        'app showed failed',
        'unsuccessful',
        'পেমেন্ট ব্যর্থ',
        'ব্যালেন্স কেটেছে',
      ])
    ) {
      caseType = CaseType.PAYMENT_FAILED;
    } else if (
      hasAnyKeyword([
        'refund',
        'return my money',
        'changed my mind',
        'ফেরত দিন',
        'রিফান্ড',
      ])
    ) {
      caseType = CaseType.REFUND_REQUEST;
    } else if (
      hasAnyKeyword([
        'deducted twice',
        'duplicate',
        'double',
        'paid twice',
        'দুইবার',
        'ডাবল',
        'ডুপ্লিকেট',
        'দুই বার কেটেছে',
      ])
    ) {
      caseType = CaseType.DUPLICATE_PAYMENT;
    } else if (
      userType === UserType.MERCHANT &&
      hasAnyKeyword([
        'settlement',
        'not settled',
        'merchant',
        'settled',
        'সেটেলমেন্ট',
        'সেটেল',
      ])
    ) {
      caseType = CaseType.MERCHANT_SETTLEMENT_DELAY;
    } else if (
      matchedTxn?.type === TransactionType.CASH_IN ||
      hasAnyKeyword([
        'cash in not received',
        'cash in',
        'deposit',
        'agent',
        'ক্যাশ ইন',
        'এজেন্ট',
        'ডিপোজিট',
      ])
    ) {
      if (hasAnyKeyword(['cash in', 'deposit', 'ক্যাশ ইন', 'ডিপোজিট'])) {
        caseType = CaseType.AGENT_CASH_IN_ISSUE;
      }
    }

    // 2. Determine severity
    let severity = Severity.LOW;
    const amount = matchedTxn ? matchedTxn.amount : 0;

    if (caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING) {
      severity = Severity.CRITICAL;
    } else if (caseType === CaseType.MERCHANT_SETTLEMENT_DELAY) {
      severity = Severity.MEDIUM;
    } else if (
      evidenceVerdict === EvidenceVerdict.INCONSISTENT ||
      amount >= 5000 ||
      [
        CaseType.WRONG_TRANSFER,
        CaseType.DUPLICATE_PAYMENT,
        CaseType.AGENT_CASH_IN_ISSUE,
      ].includes(caseType)
    ) {
      severity = Severity.HIGH;
      if (caseType === CaseType.WRONG_TRANSFER && amount < 5000) {
        severity = Severity.MEDIUM;
      }
    } else if (amount >= 1000 && amount <= 4999) {
      severity = Severity.MEDIUM;

      if (caseType === CaseType.PAYMENT_FAILED) {
        // Failed payments where balance may have been deducted are high priority
        severity = Severity.HIGH;
      }
    } else if (
      caseType === CaseType.OTHER ||
      evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA ||
      (caseType === CaseType.REFUND_REQUEST && amount < 1000) ||
      caseType === CaseType.PAYMENT_FAILED
    ) {
      severity = Severity.LOW;
    }

    // 3. Determine department
    let department = Department.CUSTOMER_SUPPORT;

    switch (caseType) {
      case CaseType.WRONG_TRANSFER:
        department = Department.DISPUTE_RESOLUTION;
        break;
      case CaseType.PAYMENT_FAILED:
      case CaseType.DUPLICATE_PAYMENT:
        department = Department.PAYMENTS_OPS;
        break;
      case CaseType.REFUND_REQUEST:
        department =
          severity === Severity.HIGH || severity === Severity.CRITICAL
            ? Department.DISPUTE_RESOLUTION
            : Department.CUSTOMER_SUPPORT;
        break;
      case CaseType.MERCHANT_SETTLEMENT_DELAY:
        department = Department.MERCHANT_OPERATIONS;
        break;
      case CaseType.AGENT_CASH_IN_ISSUE:
        department = Department.AGENT_OPERATIONS;
        break;
      case CaseType.PHISHING_OR_SOCIAL_ENGINEERING:
        department = Department.FRAUD_RISK;
        break;
      case CaseType.OTHER:
        department = Department.CUSTOMER_SUPPORT;
        break;
    }

    // 4. human_review_required
    const isDispute = [
      CaseType.WRONG_TRANSFER,
      CaseType.DUPLICATE_PAYMENT,
      CaseType.AGENT_CASH_IN_ISSUE,
    ].includes(caseType);
    let humanReviewRequired = false;

    if (
      isDispute ||
      caseType === CaseType.PHISHING_OR_SOCIAL_ENGINEERING ||
      evidenceVerdict === EvidenceVerdict.INCONSISTENT ||
      severity === Severity.HIGH ||
      severity === Severity.CRITICAL ||
      (evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA &&
        caseType !== CaseType.OTHER)
    ) {
      humanReviewRequired = true;
    }

    // Exception for refund_request which usually is false unless contested
    if (caseType === CaseType.REFUND_REQUEST) {
      humanReviewRequired = false;
    }
    // Exception for failed payment
    if (caseType === CaseType.PAYMENT_FAILED) {
      humanReviewRequired = false;
    }
    if (caseType === CaseType.MERCHANT_SETTLEMENT_DELAY) {
      humanReviewRequired = false;
    }
    if (caseType === CaseType.OTHER) {
      humanReviewRequired = false;
    }
    if (
      caseType === CaseType.WRONG_TRANSFER &&
      evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA
    ) {
      humanReviewRequired = false;
    }

    // 5. reason_codes & confidence
    const reasonCodes: string[] = [caseType];
    if (matchedTxn) {
      reasonCodes.push('transaction_match');
    }
    if (humanReviewRequired) {
      reasonCodes.push('review_flagged');
    }

    let confidence = 0.8;
    if (evidenceVerdict === EvidenceVerdict.CONSISTENT) confidence = 0.9;
    if (evidenceVerdict === EvidenceVerdict.INSUFFICIENT_DATA) confidence = 0.6;
    if (evidenceVerdict === EvidenceVerdict.INCONSISTENT) confidence = 0.75;

    return {
      case_type: caseType,
      severity,
      department,
      human_review_required: humanReviewRequired,
      confidence,
      reason_codes: reasonCodes,
    };
  }
}
