import { IsString, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  TransactionType,
  TransactionStatus,
} from '../../common/enums/taxonomy';

export class TransactionHistoryEntryDto {
  @ApiProperty({ example: 'TXN-9101', description: 'Unique transaction ID' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({ example: '2026-04-14T10:30:00Z', description: 'Transaction timestamp' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.TRANSFER })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 5000, description: 'Transaction amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: '+8801712345678', description: 'Counterparty associated with the transaction' })
  @IsString()
  @IsNotEmpty()
  counterparty: string;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;
}
