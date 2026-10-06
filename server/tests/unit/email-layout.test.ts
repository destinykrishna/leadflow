import { describe, it, expect } from 'vitest';
import {
  wrapTransactionalEmail,
  DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATE,
} from '../../src/utils/email-layout.js';
import { renderTemplate } from '../../src/utils/template.js';

describe('LeadFlow B2B SaaS Transactional Email Template & Layout', () => {
  it('wraps a basic message body into the polished LeadFlow B2B email layout', () => {
    const message = '<p>Your mortgage application has moved to the Qualification stage.</p>';
    const wrapped = wrapTransactionalEmail(message, {
      subject: 'Mortgage Stage Update',
      brokerageName: 'Apex Home Finance',
      advisorEmail: 'advisor@apex.com',
    });

    // Contains table-based presentation attributes for email safety
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('role="presentation"');
    expect(wrapped).toContain('cellpadding="0"');
    expect(wrapped).toContain('cellspacing="0"');

    // Contains LeadFlow branding, header badge, and sapphire accent
    expect(wrapped).toContain('LeadFlow');
    expect(wrapped).toContain('LF');
    expect(wrapped).toContain('#2563eb');

    // Contains footer attribution and help line
    expect(wrapped).toContain('Sent via <strong>LeadFlow</strong>');
    expect(wrapped).toContain('Apex Home Finance');
    expect(wrapped).toContain('advisor@apex.com');

    // Preserves original content inside
    expect(wrapped).toContain(message);
  });

  it('is idempotent and does not double-wrap an already-formatted email', () => {
    const alreadyFormatted = DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATE.body;
    const rewrapped = wrapTransactionalEmail(alreadyFormatted);

    expect(rewrapped).toBe(alreadyFormatted);
  });

  it('renders DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATE cleanly with dynamic context placeholders', () => {
    const context = {
      lead: {
        firstName: 'Stefan',
        lastName: 'Zweig',
        fullName: 'Stefan Zweig',
        email: 'stefan@austria.at',
      },
      advisor: {
        name: 'Elena Schmidt',
        email: 'elena@berlin-mortgages.de',
      },
      brokerage: {
        name: 'Berlin Expat Mortgages',
      },
      stage: 'QUALIFIED',
    };

    const rendered = renderTemplate(DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATE.body, context);

    // Verify all dynamic placeholders are interpolated cleanly
    expect(rendered).toContain('Hi Stefan,');
    expect(rendered).toContain('Berlin Expat Mortgages');
    expect(rendered).toContain('Elena Schmidt');
    expect(rendered).toContain('Stefan Zweig');
    expect(rendered).toContain('mailto:elena@berlin-mortgages.de');
    expect(rendered).toContain('QUALIFIED');

    // Verify no unrendered double-curly placeholders remain
    expect(rendered).not.toContain('{{lead.');
    expect(rendered).not.toContain('{{advisor.');
    expect(rendered).not.toContain('{{brokerage.');

    // Verify presence of table layout and CTA
    expect(rendered).toContain('Contact Your Advisor');
    expect(rendered).toContain('Your Mortgage Inquiry Has Been Received');
  });

  it('handles empty content gracefully', () => {
    expect(wrapTransactionalEmail('')).toBe('');
  });
});
