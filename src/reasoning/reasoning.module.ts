import { Module } from '@nestjs/common';
import { TransactionMatcherService } from './transaction-matcher.service';
import { EvidenceAnalyzerService } from './evidence-analyzer.service';
import { ClassifierService } from './classifier.service';
import { ReasoningService } from './reasoning.service';
import { LlmModule } from '../llm/llm.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [LlmModule, SafetyModule],
  providers: [
    TransactionMatcherService,
    EvidenceAnalyzerService,
    ClassifierService,
    ReasoningService,
  ],
  exports: [ReasoningService],
})
export class ReasoningModule {}
