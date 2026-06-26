import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import sampleCases from '../resources/SUST_Preli_Sample_Cases.json';

const CASES = sampleCases.cases;

describe('POST /analyze-ticket — All 10 Sample Cases (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(CASES)(
    '$id: $label',
    ({ input, expected_output }) => {
      return request(app.getHttpServer())
        .post('/analyze-ticket')
        .send(input)
        .expect(200)
        .expect((res) => {
          expect(res.body.ticket_id).toBe(expected_output.ticket_id);
          expect(res.body.relevant_transaction_id).toBe(
            expected_output.relevant_transaction_id,
          );
          expect(res.body.evidence_verdict).toBe(
            expected_output.evidence_verdict,
          );
          expect(res.body.case_type).toBe(expected_output.case_type);
          expect(res.body.severity).toBe(expected_output.severity);
          expect(res.body.department).toBe(expected_output.department);
          expect(res.body.human_review_required).toBe(
            expected_output.human_review_required,
          );
          expect(typeof res.body.agent_summary).toBe('string');
          expect(res.body.agent_summary.length).toBeGreaterThan(10);
          expect(typeof res.body.recommended_next_action).toBe('string');
          expect(res.body.recommended_next_action.length).toBeGreaterThan(10);
          expect(typeof res.body.customer_reply).toBe('string');
          expect(res.body.customer_reply.length).toBeGreaterThan(10);
        });
    },
  );
});
