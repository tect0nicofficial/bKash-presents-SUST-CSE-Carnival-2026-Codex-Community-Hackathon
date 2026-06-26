import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Language, Channel, UserType } from '../../common/enums/taxonomy';
import { TransactionHistoryEntryDto } from './transaction-history-entry.dto';

export class AnalyzeTicketRequestDto {
  @ApiProperty({ example: 'TKT-001', description: 'Unique ticket ID' })
  @IsString()
  @IsNotEmpty()
  ticket_id: string;

  @ApiProperty({ example: 'I sent 5000 taka to a wrong number', description: 'Customer complaint text' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  complaint: string;

  @ApiPropertyOptional({ enum: Language, example: Language.EN })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ enum: Channel, example: Channel.IN_APP_CHAT })
  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @ApiPropertyOptional({ enum: UserType, example: UserType.CUSTOMER })
  @IsOptional()
  @IsEnum(UserType)
  user_type?: UserType;

  @ApiPropertyOptional({ example: 'Q3_CASHBACK_OFFER' })
  @IsOptional()
  @IsString()
  campaign_context?: string;

  @ApiPropertyOptional({ type: [TransactionHistoryEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionHistoryEntryDto)
  transaction_history?: TransactionHistoryEntryDto[];

  @ApiPropertyOptional({ example: { "device": "ios" } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
