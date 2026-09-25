import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { renderTemplate, buildTemplateContext } from '../../src/utils/template.js';
import { maskEmail } from '../../src/utils/mask.js';
import { Task, type ITaskDocument } from '../../src/models/task.model.js';
import { Brokerage } from '../../src/models/brokerage.model.js';
import { User } from '../../src/models/user.model.js';
import { Lead } from '../../src/models/lead.model.js';

describe('Trigger Service & Automation Unit Tests', () => {
  let brokerageId: Types.ObjectId;
  let advisorId: Types.ObjectId;

  beforeEach(() => {
    brokerageId = new Types.ObjectId();
    advisorId = new Types.ObjectId();
  });

  describe('1. Email & Task Placeholder Rendering', () => {
    it('correctly substitutes nested and flat lead placeholders', () => {
      const mockLead = {
        _id: new Types.ObjectId(),
        firstName: 'Maximilian',
        lastName: 'Mueller',
        email: 'max.mueller@techcorp.de',
        phone: '+49 170 9988776',
        status: 'QUALIFIED',
        source: 'WEBSITE',
        score: 92,
        notes: 'Needs 450k mortgage',
        customFields: {
          propertyCity: 'Berlin',
          loanAmount: '450000',
        },
      } as any;

      const mockAdvisor = {
        _id: advisorId,
        name: 'Elena Schmidt',
        email: 'elena@berlin-mortgages.de',
      } as any;

      const mockBrokerage = {
        _id: brokerageId,
        name: 'Berlin Expat Mortgages',
        slug: 'berlin-expat',
      } as any;

      const context = buildTemplateContext({
        lead: mockLead,
        advisor: mockAdvisor,
        brokerage: mockBrokerage,
        previousStage: 'CONTACTED',
        newStage: 'QUALIFIED',
      });

      // Test flat variables
      const template1 = 'Hello {{firstName}} {{lastName}}, welcome to {{brokerageName}}!';
      expect(renderTemplate(template1, context)).toBe(
        'Hello Maximilian Mueller, welcome to Berlin Expat Mortgages!'
      );

      // Test nested variables
      const template2 =
        'Dear {{lead.fullName}}, your advisor is {{advisor.name}} ({{advisor.email}}). Stage: {{stage}}.';
      expect(renderTemplate(template2, context)).toBe(
        'Dear Maximilian Mueller, your advisor is Elena Schmidt (elena@berlin-mortgages.de). Stage: QUALIFIED.'
      );

      // Test custom fields
      const template3 = 'Property location: {{propertyCity}}, Requested loan: {{loanAmount}} EUR';
      expect(renderTemplate(template3, context)).toBe(
        'Property location: Berlin, Requested loan: 450000 EUR'
      );
    });

    it('safely handles missing or undefined variables by replacing with empty string', () => {
      const mockLead = {
        _id: new Types.ObjectId(),
        firstName: 'Stefan',
        lastName: 'Weber',
        email: 'stefan@weber.de',
        status: 'NEW',
      } as any;

      const context = buildTemplateContext({
        lead: mockLead,
      });

      const template = 'Hello {{firstName}}, advisor: {{advisorName}}, nonExistent: {{missingField}}';
      expect(renderTemplate(template, context)).toBe('Hello Stefan, advisor: , nonExistent: ');
    });

    it('handles empty templates gracefully', () => {
      expect(renderTemplate('', {})).toBe('');
    });
  });

  describe('2. PII Email Masking Utility', () => {
    it('masks standard email addresses properly', () => {
      expect(maskEmail('alex.expat@gmail.com')).toBe('a***t@gmail.com');
      expect(maskEmail('david.chen@mortgages.de')).toBe('d***n@mortgages.de');
      expect(maskEmail('info@leadflow.io')).toBe('i***o@leadflow.io');
    });

    it('masks short usernames safely', () => {
      expect(maskEmail('al@domain.com')).toBe('a***@domain.com');
      expect(maskEmail('a@domain.com')).toBe('a***@domain.com');
    });

    it('handles invalid or empty email gracefully', () => {
      expect(maskEmail('')).toBe('***@***');
      expect(maskEmail('invalid-email')).toBe('***@***');
    });
  });

  describe('3. Task Model Overdue Status Virtual', () => {
    it('returns true when task is PENDING and dueDate is in the past', () => {
      const task = new Task({
        brokerageId,
        title: 'Call lead immediately',
        status: 'PENDING',
        priority: 'HIGH',
        assignedTo: advisorId,
        dueDate: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      });

      expect(task.isOverdue).toBe(true);
    });

    it('returns true when task is IN_PROGRESS and dueDate is in the past', () => {
      const task = new Task({
        brokerageId,
        title: 'Review payslip',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        assignedTo: advisorId,
        dueDate: new Date(Date.now() - 60 * 1000), // 1 min ago
      });

      expect(task.isOverdue).toBe(true);
    });

    it('returns false when task is PENDING and dueDate is in the future', () => {
      const task = new Task({
        brokerageId,
        title: 'Call lead tomorrow',
        status: 'PENDING',
        priority: 'MEDIUM',
        assignedTo: advisorId,
        dueDate: new Date(Date.now() + 86400 * 1000), // 1 day in future
      });

      expect(task.isOverdue).toBe(false);
    });

    it('returns false when task is COMPLETED even if dueDate is in the past', () => {
      const task = new Task({
        brokerageId,
        title: 'Initial consultation call',
        status: 'COMPLETED',
        priority: 'HIGH',
        assignedTo: advisorId,
        dueDate: new Date(Date.now() - 86400 * 1000),
        completedAt: new Date(),
      });

      expect(task.isOverdue).toBe(false);
    });

    it('returns false when task is CANCELLED even if dueDate is in the past', () => {
      const task = new Task({
        brokerageId,
        title: 'Old meeting',
        status: 'CANCELLED',
        priority: 'LOW',
        assignedTo: advisorId,
        dueDate: new Date(Date.now() - 86400 * 1000),
      });

      expect(task.isOverdue).toBe(false);
    });

    it('returns false when task has no dueDate set', () => {
      const task = new Task({
        brokerageId,
        title: 'Open ended task',
        status: 'PENDING',
        priority: 'LOW',
        assignedTo: advisorId,
        dueDate: null,
      });

      expect(task.isOverdue).toBe(false);
    });
  });

  describe('4. Template Security & Anti-Leak Defenses', () => {
    it('blocks prototype property access and prototype pollution keys', () => {
      const mockLead = {
        _id: new Types.ObjectId(),
        firstName: 'Security',
        lastName: 'Tester',
        email: 'sec@test.de',
        status: 'NEW',
      } as any;

      const context = buildTemplateContext({ lead: mockLead });

      expect(renderTemplate('Proto: {{__proto__}}', context)).toBe('Proto: ');
      expect(renderTemplate('Constructor: {{constructor}}', context)).toBe('Constructor: ');
      expect(renderTemplate('Prototype: {{prototype}}', context)).toBe('Prototype: ');
      expect(renderTemplate('ToString: {{toString}}', context)).toBe('ToString: ');
      expect(renderTemplate('ValueOf: {{valueOf}}', context)).toBe('ValueOf: ');
      expect(renderTemplate('Nested constructor: {{lead.constructor}}', context)).toBe('Nested constructor: ');
    });

    it('sanitizes and suppresses sensitive keys in custom fields or extra params', () => {
      const mockLead = {
        _id: new Types.ObjectId(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'NEW',
        customFields: {
          secretToken: 'shhh-secret-123',
          password: 'super-secret-password',
          apiKey: 'key-999-xyz',
          loanAmount: '350000',
        },
      } as any;

      const context = buildTemplateContext({
        lead: mockLead,
        extra: {
          webhookSecret: 'top-secret-webhook',
          safeNote: 'Follow up by tomorrow',
        },
      });

      // Sensitive fields must be stripped
      expect(renderTemplate('Secret: {{secretToken}}', context)).toBe('Secret: ');
      expect(renderTemplate('Pass: {{password}}', context)).toBe('Pass: ');
      expect(renderTemplate('API: {{apiKey}}', context)).toBe('API: ');
      expect(renderTemplate('Webhook: {{webhookSecret}}', context)).toBe('Webhook: ');

      // Legitimate business fields remain accessible
      expect(renderTemplate('Loan: {{loanAmount}}', context)).toBe('Loan: 350000');
      expect(renderTemplate('Note: {{safeNote}}', context)).toBe('Note: Follow up by tomorrow');
    });
  });
});

