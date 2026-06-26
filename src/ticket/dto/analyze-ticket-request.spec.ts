import 'reflect-metadata';
import { validate } from 'class-validator';
import { AnalyzeTicketRequestDto } from './analyze-ticket-request.dto';
// No taxonomy imports needed for this basic test

describe('AnalyzeTicketRequestDto Validation', () => {
  it('should pass validation with valid request', async () => {
    const dto = new AnalyzeTicketRequestDto();
    dto.ticket_id = '123';
    dto.complaint = 'test complaint';
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when ticket_id is missing', async () => {
    const dto = new AnalyzeTicketRequestDto();
    dto.complaint = 'test complaint';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('ticket_id');
  });

  it('should fail when complaint is missing', async () => {
    const dto = new AnalyzeTicketRequestDto();
    dto.ticket_id = '123';
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('complaint');
  });

  it('should fail on invalid enum', async () => {
    const dto = new AnalyzeTicketRequestDto();
    dto.ticket_id = '123';
    dto.complaint = 'test complaint';
    (dto as unknown as { language: string }).language = 'fr'; // invalid
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('language');
  });
});
