import crypto from 'node:crypto';
import { Resend } from 'resend';
import { UnrecoverableError } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/mask.js';
import { wrapTransactionalEmail } from '../utils/email-layout.js';

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

export class ResendEmailService implements IEmailService {
  private resend: Resend | null = null;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || env.RESEND_API_KEY || '';
    this.defaultFrom = defaultFrom || `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;
    if (this.apiKey) {
      this.resend = new Resend(this.apiKey);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const masked = maskEmail(options.to);
    const from = options.from || this.defaultFrom;

    if (!this.resend) {
      if (!this.apiKey) {
        throw new UnrecoverableError('Resend API key is not configured');
      }
      this.resend = new Resend(this.apiKey);
    }

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
      'ResendEmailService: Preparing to dispatch email message via Resend'
    );

    try {
      const isHtml = options.body.includes('<') && options.body.includes('>');
      const rawContent = isHtml
        ? options.body
        : `<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${options.body}</p>`;
      const htmlBody = wrapTransactionalEmail(rawContent, {
        subject: options.subject,
      });

      const tags: { name: string; value: string }[] = [
        { name: 'brokerage_id', value: options.brokerageId },
      ];
      if (options.leadId) {
        tags.push({ name: 'lead_id', value: options.leadId });
      }
      if (options.templateId) {
        tags.push({ name: 'template_id', value: options.templateId });
      }

      const response = await this.resend.emails.send({
        from,
        to: [options.to],
        subject: options.subject,
        html: htmlBody,
        text: options.body,
        tags,
        headers: {
          'X-Entity-Ref-ID': options.leadId || options.brokerageId,
        },
        ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
      });

      if (response.error) {
        const errMsg = response.error.message || 'Unknown Resend error';
        const errName = String(response.error.name || '');
        logger.error(
          {
            brokerageId: options.brokerageId,
            recipient: masked,
            errorName: errName,
            errorMessage: errMsg,
          },
          'ResendEmailService: Resend dispatch error encountered'
        );

        // Terminal error classification (invalid domain, invalid recipient, unauthenticated)
        if (
          errName === 'validation_error' ||
          errName === 'invalid_parameter' ||
          errName === 'restricted_action' ||
          errMsg.includes('not verified') ||
          errMsg.includes('domain is not verified') ||
          errMsg.includes('invalid')
        ) {
          throw new UnrecoverableError(`Resend terminal failure: ${errMsg}`);
        }

        // Transient error classification (rate limiting, timeout, network error)
        throw new EmailProviderTransientError(`Resend transient failure: ${errMsg}`);
      }

      const messageId = response.data?.id || `msg_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const sentAt = new Date();

      logger.info(
        {
          messageId,
          brokerageId: options.brokerageId,
          recipient: masked,
        },
        'ResendEmailService: Email successfully accepted by Resend'
      );

      return {
        messageId,
        sentAt,
        status: 'SENT',
      };
    } catch (err: unknown) {
      if (err instanceof UnrecoverableError || err instanceof EmailProviderTransientError) {
        throw err;
      }
      const message = (err as Error)?.message || 'Unexpected error sending email';
      logger.error({ err: message, brokerageId: options.brokerageId, recipient: masked }, 'ResendEmailService: Unexpected dispatch failure');
      throw new EmailProviderTransientError(`Resend dispatch error: ${message}`);
    }
  }

  getSentEmails(): SentEmailRecord[] {
    return [];
  }

  clearSentEmails(): void {}

  setSimulationMode(): void {}
}

export function createEmailService(): IEmailService {
  if (env.isTest) {
    return new MockEmailService();
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    return new ResendEmailService();
  }
  return new MockEmailService();
}

let activeEmailService: IEmailService = createEmailService();

export function setEmailService(service: IEmailService): void {
  activeEmailService = service;
}

export const emailService: IEmailService = {
  sendEmail: (opts) => activeEmailService.sendEmail(opts),
  getSentEmails: () => activeEmailService.getSentEmails(),
  clearSentEmails: () => activeEmailService.clearSentEmails(),
  setSimulationMode: (cfg) => activeEmailService.setSimulationMode(cfg),
};
