import crypto from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/mask.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string | undefined;
  brokerageId: string;
  leadId?: string | undefined;
  recipientName?: string | undefined;
  recipientType?: string | undefined;
  templateId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  simulateFailure?: boolean | undefined;
  simulateTerminalFailure?: boolean | undefined;
}

export interface SendEmailResult {
  messageId: string;
  sentAt: Date;
  status: 'SENT' | 'FAILED';
}

export interface SentEmailRecord {
  messageId: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  brokerageId: string;
  leadId?: string | undefined;
  sentAt: Date;
}

export class EmailProviderTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailProviderTransientError';
  }
}

export interface IEmailService {
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  getSentEmails(): SentEmailRecord[];
  clearSentEmails(): void;
  setSimulationMode(config: {
    transientFailuresRemaining?: number;
    terminalFailuresRemaining?: number;
  }): void;
}

export class MockEmailService implements IEmailService {
  private sentEmails: SentEmailRecord[] = [];
  private transientFailuresRemaining = 0;
  private terminalFailuresRemaining = 0;

  setSimulationMode(config: {
    transientFailuresRemaining?: number;
    terminalFailuresRemaining?: number;
  }): void {
    this.transientFailuresRemaining = config.transientFailuresRemaining ?? 0;
    this.terminalFailuresRemaining = config.terminalFailuresRemaining ?? 0;
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const from = options.from || 'notifications@leadflow.io';
    const masked = maskEmail(options.to);

    logger.info(
      {
        brokerageId: options.brokerageId,
        leadId: options.leadId,
        templateId: options.templateId,
        recipientType: options.recipientType,
        recipient: masked,
        from,
        subjectLength: options.subject.length,
      },
      'EmailService: Preparing to dispatch email message'
    );

    // 1. Check for simulated terminal failure (unrecoverable error -> no BullMQ retry)
    if (options.simulateTerminalFailure || this.terminalFailuresRemaining > 0) {
      if (this.terminalFailuresRemaining > 0) {
        this.terminalFailuresRemaining--;
      }
      logger.error(
        {
          brokerageId: options.brokerageId,
          recipient: masked,
        },
        'EmailService: Terminal provider rejection encountered (invalid recipient / domain bounce)'
      );
      throw new UnrecoverableError(
        'Email provider terminal failure: Recipient mailbox invalid or rejected'
      );
    }

    // 2. Check for simulated transient failure (retryable with exponential backoff)
    if (options.simulateFailure || this.transientFailuresRemaining > 0) {
      if (this.transientFailuresRemaining > 0) {
        this.transientFailuresRemaining--;
      }
      logger.warn(
        {
          brokerageId: options.brokerageId,
          recipient: masked,
        },
        'EmailService: Transient provider timeout/rate-limit; requesting backoff retry'
      );
      throw new EmailProviderTransientError(
        'Email provider transient failure: Network timeout connecting to upstream SMTP relay'
      );
    }

    // 3. Normal successful dispatch
    const messageId = `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const sentRecord: SentEmailRecord = {
      messageId,
      to: options.to,
      from,
      subject: options.subject,
      body: options.body,
      brokerageId: options.brokerageId,
      leadId: options.leadId,
      sentAt: new Date(),
    };

    this.sentEmails.push(sentRecord);

    logger.info(
      {
        messageId,
        brokerageId: options.brokerageId,
        recipient: masked,
      },
      'EmailService: Email successfully delivered to recipient'
    );

    return {
      messageId,
      sentAt: sentRecord.sentAt,
      status: 'SENT',
    };
  }

  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  clearSentEmails(): void {
    this.sentEmails = [];
    this.transientFailuresRemaining = 0;
    this.terminalFailuresRemaining = 0;
  }
}

export const emailService = new MockEmailService();
