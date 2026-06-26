import { Injectable, Logger } from '@nestjs/common';
import { TransactionHistoryEntryDto } from '../ticket/dto/transaction-history-entry.dto';
import { withinSeconds } from '../common/utils/time.util';

export interface MatchResult {
  transactionId: string;
  score: number;
}

@Injectable()
export class TransactionMatcherService {
  private readonly logger = new Logger(TransactionMatcherService.name);

  matchTransaction(
    complaint: string,
    history: TransactionHistoryEntryDto[],
  ): MatchResult | null {
    if (!history || history.length === 0) {
      return null;
    }

    const complaintLower = complaint.toLowerCase();
    const complaintNormalized = this.normalizeText(complaint);

    // Parse amounts (handles both Latin and Bangla digits)
    const amountRegex = /([০-৯\d][০-৯\d,]*\.?\d*)\s*(taka|tk|bdt|₹)?/gi;
    const mentionedAmounts: number[] = [];
    let match;
    while ((match = amountRegex.exec(complaint)) !== null) {
      const amtStr = this.normalizeDigits(match[1]).replace(/,/g, '');
      const amt = parseFloat(amtStr);
      if (!isNaN(amt)) {
        mentionedAmounts.push(amt);
      }
    }

    // Type keywords mapping (English + Bangla transliterations)
    const typeKeywords: Record<string, string[]> = {
      transfer: [
        'sent',
        'transfer',
        'wrong number',
        'পাঠিয়েছি',
        'ট্রান্সফার',
        'পাঠানো',
      ],
      payment: ['pay', 'paid', 'bill', 'recharge', 'পেমেন্ট', 'বিল', 'দিয়েছি'],
      cash_in: ['cash in', 'deposit', 'agent', 'ক্যাশ ইন', 'ডিপোজিট', 'এজেন্ট'],
      cash_out: ['cash out', 'withdraw', 'ক্যাশ আউট', 'উত্তোলন'],
      settlement: [
        'settlement',
        'settled',
        'not received',
        'সেটেলমেন্ট',
        'সেটেল',
      ],
      refund: ['refund', 'return', 'রিফান্ড', 'ফেরত'],
    };

    const scores = history.map((txn) => {
      let score = 0;

      // 1. Amount match (+40 exact, +20 within 10%)
      let bestAmountScore = 0;
      for (const mentionedAmount of mentionedAmounts) {
        if (mentionedAmount === txn.amount) {
          bestAmountScore = Math.max(bestAmountScore, 40);
        } else if (Math.abs(mentionedAmount - txn.amount) / txn.amount <= 0.1) {
          bestAmountScore = Math.max(bestAmountScore, 20);
        }
      }
      score += bestAmountScore;

      // 2. Counterparty mentioned in complaint: +35
      const counterpartyLower = txn.counterparty.toLowerCase();
      const counterpartyClean = counterpartyLower
        .replace(/^\+88/, '')
        .replace(/\D/g, '');

      if (complaintLower.includes(counterpartyLower)) {
        score += 35;
      } else if (
        counterpartyClean.length > 5 &&
        complaint.replace(/\D/g, '').includes(counterpartyClean)
      ) {
        score += 35;
      }

      // 3. Type keyword match: +15
      const keywords = typeKeywords[txn.type] || [];
      const hasTypeKeyword =
        keywords.some((kw) => complaintLower.includes(kw)) ||
        keywords.some((kw) => complaintNormalized.includes(kw));
      if (hasTypeKeyword) {
        score += 15;
      }

      // 4. Time proximity match: +10
      const timeKeywords = [
        'today',
        'yesterday',
        'pm',
        'am',
        'morning',
        'evening',
        'night',
        'আজ',
        'গতকাল',
      ];
      if (timeKeywords.some((kw) => complaintLower.includes(kw))) {
        score += 10;
      }

      return { transactionId: txn.transaction_id, score };
    });

    // Sort descending by score
    scores.sort((a, b) => b.score - a.score);

    const top = scores[0];

    // If best score < 50, return null
    if (top.score < 50) {
      this.logger.debug(
        `Best match score for complaint is ${top.score} (<50), returning null`,
      );
      return null;
    }

    // Ambiguity check: If top 2 scores differ by < 10, check for duplicate pattern
    if (scores.length > 1) {
      const second = scores[1];
      if (top.score - second.score < 10) {
        // Check if the top 2 transactions are duplicates (same amount, counterparty, within 60s)
        const topTxn = history.find(
          (t) => t.transaction_id === top.transactionId,
        );
        const secondTxn = history.find(
          (t) => t.transaction_id === second.transactionId,
        );

        if (topTxn && secondTxn) {
          const isDuplicate =
            topTxn.amount === secondTxn.amount &&
            topTxn.counterparty === secondTxn.counterparty &&
            topTxn.type === secondTxn.type &&
            withinSeconds(topTxn.timestamp, secondTxn.timestamp, 60);

          if (isDuplicate) {
            // Return the later transaction as the suspected duplicate
            const laterTxn =
              new Date(topTxn.timestamp) > new Date(secondTxn.timestamp)
                ? topTxn
                : secondTxn;
            this.logger.debug(
              `Duplicate pattern detected: ${topTxn.transaction_id} and ${secondTxn.transaction_id}, returning later one`,
            );
            return { transactionId: laterTxn.transaction_id, score: top.score };
          }
        }

        this.logger.debug(
          `Ambiguous match: top score ${top.score} vs second score ${second.score}`,
        );
        return null;
      }
    }

    return top;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[া-ৌ]/g, '') // Remove Bangla vowel marks for loose matching
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeDigits(str: string): string {
    const banglaToLatin: Record<string, string> = {
      '০': '0',
      '১': '1',
      '২': '2',
      '৩': '3',
      '৪': '4',
      '৫': '5',
      '৬': '6',
      '৭': '7',
      '৮': '8',
      '৯': '9',
    };
    return str.replace(/[০-৯]/g, (d) => banglaToLatin[d] || d);
  }
}
