export enum CaseType {
  WRONG_TRANSFER = 'wrong_transfer',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_REQUEST = 'refund_request',
  DUPLICATE_PAYMENT = 'duplicate_payment',
  MERCHANT_SETTLEMENT_DELAY = 'merchant_settlement_delay',
  AGENT_CASH_IN_ISSUE = 'agent_cash_in_issue',
  PHISHING_OR_SOCIAL_ENGINEERING = 'phishing_or_social_engineering',
  OTHER = 'other',
}

export enum Department {
  CUSTOMER_SUPPORT = 'customer_support',
  DISPUTE_RESOLUTION = 'dispute_resolution',
  PAYMENTS_OPS = 'payments_ops',
  MERCHANT_OPERATIONS = 'merchant_operations',
  AGENT_OPERATIONS = 'agent_operations',
  FRAUD_RISK = 'fraud_risk',
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum EvidenceVerdict {
  CONSISTENT = 'consistent',
  INCONSISTENT = 'inconsistent',
  INSUFFICIENT_DATA = 'insufficient_data',
}

export enum Language {
  EN = 'en',
  BN = 'bn',
  MIXED = 'mixed',
}

export enum Channel {
  IN_APP_CHAT = 'in_app_chat',
  CALL_CENTER = 'call_center',
  EMAIL = 'email',
  MERCHANT_PORTAL = 'merchant_portal',
  FIELD_AGENT = 'field_agent',
}

export enum UserType {
  CUSTOMER = 'customer',
  MERCHANT = 'merchant',
  AGENT = 'agent',
  UNKNOWN = 'unknown',
}

export enum TransactionType {
  TRANSFER = 'transfer',
  PAYMENT = 'payment',
  CASH_IN = 'cash_in',
  CASH_OUT = 'cash_out',
  SETTLEMENT = 'settlement',
  REFUND = 'refund',
}

export enum TransactionStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  PENDING = 'pending',
  REVERSED = 'reversed',
}
