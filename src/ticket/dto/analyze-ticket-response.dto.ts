import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import {
  EvidenceVerdict,
  CaseType,
  Severity,
  Department,
} from '../../common/enums/taxonomy';

export class AnalyzeTicketResponseDto {
  @IsString()
  @IsNotEmpty()
  ticket_id: string;

  relevant_transaction_id: string | null;

  @IsEnum(EvidenceVerdict)
  evidence_verdict: EvidenceVerdict;

  @IsEnum(CaseType)
  case_type: CaseType;

  @IsEnum(Severity)
  severity: Severity;

  @IsEnum(Department)
  department: Department;

  @IsString()
  @IsNotEmpty()
  agent_summary: string;

  @IsString()
  @IsNotEmpty()
  recommended_next_action: string;

  @IsString()
  @IsNotEmpty()
  customer_reply: string;

  @IsBoolean()
  human_review_required: boolean;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reason_codes?: string[];
}
