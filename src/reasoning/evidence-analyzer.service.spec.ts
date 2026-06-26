import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceAnalyzerService } from './evidence-analyzer.service';
import { EvidenceVerdict } from '../common/enums/taxonomy';

describe('EvidenceAnalyzerService', () => {
  let service: EvidenceAnalyzerService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvidenceAnalyzerService],
    }).compile();
    service = module.get<EvidenceAnalyzerService>(EvidenceAnalyzerService);
  });

  it('returns consistent when complaint matches transaction', () => {
    const result = service.analyzeEvidence(
      'I sent 5000 taka to a wrong number',
      {
        transaction_id: 'TXN-001',
        timestamp: '2026-04-14T14:00:00Z',
        type: 'transfer',
        amount: 5000,
        counterparty: '+8801712345678',
        status: 'completed',
      },
      [],
    );
    expect(result).toBe(EvidenceVerdict.CONSISTENT);
  });

  it('returns insufficient_data when no transaction matched', () => {
    const result = service.analyzeEvidence(
      'Something is wrong with my money',
      null,
      [],
    );
    expect(result).toBe(EvidenceVerdict.INSUFFICIENT_DATA);
  });

  it('detects inconsistency: wrong transfer claim but prior transfers to same party', () => {
    const matchedTxn = {
      transaction_id: 'TXN-002',
      timestamp: '2026-04-14T11:30:00Z',
      type: 'transfer',
      amount: 2000,
      counterparty: '+8801812345678',
      status: 'completed',
    };
    const history = [
      matchedTxn,
      {
        transaction_id: 'TXN-001',
        timestamp: '2026-04-10T09:15:00Z',
        type: 'transfer',
        amount: 2500,
        counterparty: '+8801812345678',
        status: 'completed',
      },
      {
        transaction_id: 'TXN-000',
        timestamp: '2026-04-05T17:45:00Z',
        type: 'transfer',
        amount: 1500,
        counterparty: '+8801812345678',
        status: 'completed',
      },
    ];
    const result = service.analyzeEvidence(
      'I sent 2000 to the wrong person by mistake',
      matchedTxn,
      history,
    );
    expect(result).toBe(EvidenceVerdict.INCONSISTENT);
  });

  it('detects duplicate payment pattern as consistent', () => {
    const matchedTxn = {
      transaction_id: 'TXN-10002',
      timestamp: '2026-04-14T08:15:42Z',
      type: 'payment',
      amount: 850,
      counterparty: 'BILLER-001',
      status: 'completed',
    };
    const history = [
      {
        transaction_id: 'TXN-10001',
        timestamp: '2026-04-14T08:15:30Z',
        type: 'payment',
        amount: 850,
        counterparty: 'BILLER-001',
        status: 'completed',
      },
      matchedTxn,
    ];
    const result = service.analyzeEvidence(
      'paid twice for my bill',
      matchedTxn,
      history,
    );
    expect(result).toBe(EvidenceVerdict.CONSISTENT);
  });

  it('detects claim_failed inconsistency: complaint says failed but txn completed', () => {
    const matchedTxn = {
      transaction_id: 'TXN-003',
      timestamp: '2026-04-14T16:00:00Z',
      type: 'payment',
      amount: 1200,
      counterparty: 'MERCHANT-001',
      status: 'completed',
    };
    const result = service.analyzeEvidence(
      'My payment failed but balance deducted',
      matchedTxn,
      [matchedTxn],
    );
    expect(result).toBe(EvidenceVerdict.INCONSISTENT);
  });
});
