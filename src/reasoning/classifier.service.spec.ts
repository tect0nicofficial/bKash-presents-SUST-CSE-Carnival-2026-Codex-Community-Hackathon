import { Test, TestingModule } from '@nestjs/testing';
import { ClassifierService } from './classifier.service';
import {
  CaseType,
  Severity,
  Department,
  EvidenceVerdict,
  UserType,
  TransactionType,
} from '../common/enums/taxonomy';

describe('ClassifierService', () => {
  let service: ClassifierService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassifierService],
    }).compile();
    service = module.get<ClassifierService>(ClassifierService);
  });

  it('classifies wrong_transfer', () => {
    const result = service.classify({
      complaint: 'I sent money to a wrong number please help',
      evidenceVerdict: EvidenceVerdict.CONSISTENT,
      matchedTxn: {
        transaction_id: 'TXN-001',
        timestamp: '2026-04-14T14:00:00Z',
        type: TransactionType.TRANSFER,
        amount: 5000,
        counterparty: '+8801712345678',
        status: 'completed',
      },
    });
    expect(result.case_type).toBe(CaseType.WRONG_TRANSFER);
    expect(result.severity).toBe(Severity.HIGH);
    expect(result.department).toBe(Department.DISPUTE_RESOLUTION);
    expect(result.human_review_required).toBe(true);
  });

  it('classifies payment_failed with HIGH severity for amount >= 1000', () => {
    const result = service.classify({
      complaint: 'My payment failed but balance deducted',
      evidenceVerdict: EvidenceVerdict.CONSISTENT,
      matchedTxn: {
        transaction_id: 'TXN-003',
        timestamp: '2026-04-14T16:00:00Z',
        type: TransactionType.PAYMENT,
        amount: 1200,
        counterparty: 'MERCHANT-MOBILE-OP',
        status: 'failed',
      },
    });
    expect(result.case_type).toBe(CaseType.PAYMENT_FAILED);
    expect(result.severity).toBe(Severity.HIGH);
    expect(result.department).toBe(Department.PAYMENTS_OPS);
    expect(result.human_review_required).toBe(false);
  });

  it('classifies phishing as CRITICAL', () => {
    const result = service.classify({
      complaint: 'Someone called me asking for my OTP',
      evidenceVerdict: EvidenceVerdict.INSUFFICIENT_DATA,
    });
    expect(result.case_type).toBe(CaseType.PHISHING_OR_SOCIAL_ENGINEERING);
    expect(result.severity).toBe(Severity.CRITICAL);
    expect(result.department).toBe(Department.FRAUD_RISK);
    expect(result.human_review_required).toBe(true);
  });

  it('classifies merchant settlement delay as MEDIUM', () => {
    const result = service.classify({
      complaint: 'my sales settlement is delayed. when will i get the funds?',
      evidenceVerdict: EvidenceVerdict.CONSISTENT,
      userType: UserType.MERCHANT,
      matchedTxn: {
        transaction_id: 'TXN-004',
        timestamp: '2026-04-13T18:00:00Z',
        type: TransactionType.SETTLEMENT,
        amount: 15000,
        counterparty: 'MERCHANT-SELF',
        status: 'pending',
      },
    });
    expect(result.case_type).toBe(CaseType.MERCHANT_SETTLEMENT_DELAY);
    expect(result.severity).toBe(Severity.MEDIUM);
    expect(result.department).toBe(Department.MERCHANT_OPERATIONS);
    expect(result.human_review_required).toBe(false);
  });

  it('classifies vague complaint as OTHER + LOW', () => {
    const result = service.classify({
      complaint: 'Something is wrong with my money',
      evidenceVerdict: EvidenceVerdict.INSUFFICIENT_DATA,
    });
    expect(result.case_type).toBe(CaseType.OTHER);
    expect(result.severity).toBe(Severity.LOW);
    expect(result.department).toBe(Department.CUSTOMER_SUPPORT);
    expect(result.human_review_required).toBe(false);
  });

  it('classifies agent cash in issue', () => {
    const result = service.classify({
      complaint: 'আমি এজেন্টের কাছে ২০০০ টাকা ক্যাশ ইন করেছি কিন্তু ব্যালেন্সে আসেনি',
      evidenceVerdict: EvidenceVerdict.CONSISTENT,
      matchedTxn: {
        transaction_id: 'TXN-005',
        timestamp: '2026-04-14T09:30:00Z',
        type: TransactionType.CASH_IN,
        amount: 2000,
        counterparty: 'AGENT-318',
        status: 'pending',
      },
    });
    expect(result.case_type).toBe(CaseType.AGENT_CASH_IN_ISSUE);
    expect(result.severity).toBe(Severity.HIGH);
    expect(result.department).toBe(Department.AGENT_OPERATIONS);
    expect(result.human_review_required).toBe(true);
  });

  it('classifies wrong_transfer with insufficient_data as medium, no human review', () => {
    const result = service.classify({
      complaint: 'I sent 1000 to my brother yesterday but he said not received',
      evidenceVerdict: EvidenceVerdict.INSUFFICIENT_DATA,
    });
    expect(result.case_type).toBe(CaseType.WRONG_TRANSFER);
    expect(result.severity).toBe(Severity.MEDIUM);
    expect(result.human_review_required).toBe(false);
  });
});
