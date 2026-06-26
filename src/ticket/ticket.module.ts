import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { ReasoningModule } from '../reasoning/reasoning.module';

@Module({
  imports: [ReasoningModule],
  controllers: [TicketController],
})
export class TicketModule {}
