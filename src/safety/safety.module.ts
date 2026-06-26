import { Module } from '@nestjs/common';
import { SafetyGuardrailService } from './safety-guardrail.service';

@Module({
  providers: [SafetyGuardrailService],
  exports: [SafetyGuardrailService],
})
export class SafetyModule {}
