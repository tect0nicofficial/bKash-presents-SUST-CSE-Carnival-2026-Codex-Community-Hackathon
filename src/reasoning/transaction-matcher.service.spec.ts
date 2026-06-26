import { Test, TestingModule } from '@nestjs/testing';
import { TransactionMatcherService } from './transaction-matcher.service';
import { TransactionHistoryEntryDto } from '../ticket/dto/transaction-history-entry.dto';

describe('TransactionMatcherService', () => {
  let service: TransactionMatcherService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionMatcherService],
    }).compile();
    service = module.get<TransactionMatcherService>(TransactionMatcherService);
  });

  it('matches by amount and counterparty', () => {
    const result = service.matchTransaction(
      'I sent 5000 taka to someone at 2pm today. Wrong number.',
      [
        {
          transaction_id: 'TXN-001',
          timestamp: '2026-04-14T14:00:00Z',
          type: 'transfer',
          amount: 5000,
          counterparty: '+8801712345678',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-002',
          timestamp: '2026-04-13T10:00:00Z',
          type: 'cash_in',
          amount: 10000,
          counterparty: 'AGENT-001',
          status: 'completed',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.transactionId).toBe('TXN-001');
    expect(result!.score).toBeGreaterThanOrEqual(50);
  });

  it('parses Bangla digits in amount', () => {
    const result = service.matchTransaction(
      'আমি ২০০০ টাকা ভুল নাম্বারে পাঠিয়েছি',
      [
        {
          transaction_id: 'TXN-003',
          timestamp: '2026-04-14T10:00:00Z',
          type: 'transfer',
          amount: 2000,
          counterparty: '+8801711111111',
          status: 'completed',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.transactionId).toBe('TXN-003');
  });

  it('returns null for no match (score < 50)', () => {
    const result = service.matchTransaction(
      'My account has an issue',
      [
        {
          transaction_id: 'TXN-004',
          timestamp: '2026-04-10T10:00:00Z',
          type: 'cash_in',
          amount: 5000,
          counterparty: 'AGENT-002',
          status: 'completed',
        },
      ],
    );
    expect(result).toBeNull();
  });

  it('returns null for empty history', () => {
    const result = service.matchTransaction('test complaint', []);
    expect(result).toBeNull();
  });

  it('detects duplicate pattern (same amount/counterparty/type within 60s)', () => {
    const result = service.matchTransaction(
      'I paid 850 taka for my bill but it deducted twice',
      [
        {
          transaction_id: 'TXN-005',
          timestamp: '2026-04-14T08:15:30Z',
          type: 'payment',
          amount: 850,
          counterparty: 'BILLER-001',
          status: 'completed',
        },
        {
          transaction_id: 'TXN-006',
          timestamp: '2026-04-14T08:15:42Z',
          type: 'payment',
          amount: 850,
          counterparty: 'BILLER-001',
          status: 'completed',
        },
      ],
    );
    expect(result).not.toBeNull();
    expect(result!.transactionId).toBe('TXN-006');
  });
});
