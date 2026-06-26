import { Injectable, Logger } from '@nestjs/common';
import { TransactionHistoryEntryDto } from '../ticket/dto/transaction-history-entry.dto';
import {
  EvidenceVerdict,
  TransactionType,
  TransactionStatus,
} from '../common/enums/taxonomy';
import { withinSeconds } from '../common/utils/time.util';

@Injectable()
export class EvidenceAnalyzerService {
  private readonly logger = new Logger(EvidenceAnalyzerService.name);

  analyzeEvidence(
    complaint: string,
    matchedTxn: TransactionHistoryEntryDto | null,
    allHistory: TransactionHistoryEntryDto[],
  ): EvidenceVerdict {
    const complaintLower = complaint.toLowerCase();

    if (!matchedTxn) {
      this.logger.debug(
        'No matched transaction found, verdict is insufficient_data',
      );
      return EvidenceVerdict.INSUFFICIENT_DATA;
    }

    if (this.checkDuplicatePattern(matchedTxn, allHistory)) {
      this.logger.debug('Duplicate payment pattern detected, evidence consistent');
      return EvidenceVerdict.CONSISTENT;
    }

    if (this.checkInconsistency(complaintLower, matchedTxn, allHistory)) {
      this.logger.debug('Inconsistency detected in evidence');
      return EvidenceVerdict.INCONSISTENT;
    }

    this.logger.debug('Evidence is consistent with complaint');
    return EvidenceVerdict.CONSISTENT;
  }

  private checkDuplicatePattern(
    matchedTxn: TransactionHistoryEntryDto,
    allHistory: TransactionHistoryEntryDto[],
  ): boolean {
    const duplicates = allHistory.filter(
      (t) =>
        t.transaction_id !== matchedTxn.transaction_id &&
        t.amount === matchedTxn.amount &&
        t.counterparty === matchedTxn.counterparty &&
        t.type === matchedTxn.type &&
        t.status === TransactionStatus.COMPLETED &&
        matchedTxn.status === TransactionStatus.COMPLETED &&
        withinSeconds(t.timestamp, matchedTxn.timestamp, 60),
    );
    return duplicates.length > 0;
  }

  private checkInconsistency(
    complaintLower: string,
    matchedTxn: TransactionHistoryEntryDto,
    allHistory: TransactionHistoryEntryDto[],
  ): boolean {
    const isWrongTransferClaim = [
      'wrong number',
      'wrong person',
      'mistake',
      'wrong',
    ].some((kw) => complaintLower.includes(kw));
    if (isWrongTransferClaim && matchedTxn.type === TransactionType.TRANSFER) {
      const priorTransfersToSame = allHistory.filter(
        (t) =>
          t.counterparty === matchedTxn.counterparty &&
          t.type === TransactionType.TRANSFER &&
          t.transaction_id !== matchedTxn.transaction_id,
      );
      if (priorTransfersToSame.length >= 2) {
        return true;
      }
    }

    const claimsFailed = ['failed', 'unsuccessful', 'did not go through'].some(
      (kw) => complaintLower.includes(kw),
    );
    if (claimsFailed && matchedTxn.status === TransactionStatus.COMPLETED) {
      return true;
    }

    return false;
  }
}
