import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AnalyzeTicketRequestDto } from './dto/analyze-ticket-request.dto';
import { AnalyzeTicketResponseDto } from './dto/analyze-ticket-response.dto';
import { ReasoningService } from '../reasoning/reasoning.service';

@ApiTags('ticket')
@Controller()
export class TicketController {
  constructor(private readonly reasoningService: ReasoningService) {}

  @Post('analyze-ticket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze a customer support ticket' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The ticket was successfully analyzed', type: AnalyzeTicketResponseDto })
  analyzeTicket(
    @Body() body: AnalyzeTicketRequestDto,
  ): AnalyzeTicketResponseDto {
    const reasoningResult = this.reasoningService.analyze(body);

    return {
      ticket_id: body.ticket_id,
      relevant_transaction_id: reasoningResult.relevant_transaction_id,
      evidence_verdict: reasoningResult.evidence_verdict,
      case_type: reasoningResult.case_type,
      severity: reasoningResult.severity,
      department: reasoningResult.department,
      agent_summary: reasoningResult.agent_summary,
      recommended_next_action: reasoningResult.recommended_next_action,
      customer_reply: reasoningResult.customer_reply,
      human_review_required: reasoningResult.human_review_required,
      confidence: reasoningResult.confidence,
      reason_codes: reasoningResult.reason_codes,
    };
  }
}
