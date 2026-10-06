/**
 * LeadFlow B2B SaaS Transactional Email Layout & Template Builder
 * 
 * Provides bulletproof, email-safe (table-based) HTML templates compatible with:
 * - Gmail (Web, iOS, Android)
 * - Microsoft Outlook (Desktop, Web, 365)
 * - Apple Mail
 * 
 * Design Standards:
 * - Restrained sapphire/blue accent (#2563eb)
 * - Clean typography (-apple-system, Segoe UI, Roboto, Helvetica, Arial)
 * - Generous spacing (32px content padding) and subtle borders (#e2e8f0)
 * - LeadFlow header badge + brokerage indicator
 * - Application details card and clear CTA button
 * - Professional footer with LeadFlow attribution and direct reply/help line
 */

export interface TransactionalEmailLayoutOptions {
  subject?: string | undefined;
  brokerageName?: string | undefined;
  advisorEmail?: string | undefined;
}

/**
 * Wraps arbitrary HTML or text content in the standard LeadFlow B2B transactional email layout.
 * Idempotent: If the content is already a full HTML document or already contains the LeadFlow
 * table wrapper, it is returned without double-wrapping.
 */
export function wrapTransactionalEmail(
  content: string,
  options?: TransactionalEmailLayoutOptions
): string {
  if (!content) {
    return '';
  }

  // Idempotency: avoid double-wrapping if already structured with full layout
  if (
    content.includes('<!DOCTYPE') ||
    (content.includes('<table') && content.includes('LeadFlow') && content.includes('role="presentation"'))
  ) {
    return content;
  }

  const subject = options?.subject || 'LeadFlow Notification';
  const brokerageText = options?.brokerageName || '{{brokerage.name}}';
  const advisorEmailText = options?.advisorEmail || '{{advisor.email}}';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="left" valign="middle">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background-color: #2563eb; width: 28px; height: 28px; border-radius: 6px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 13px; font-weight: 700; line-height: 28px;">
                          LF
                        </td>
                        <td style="padding-left: 10px; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
                          LeadFlow
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" style="font-size: 12px; font-weight: 500; color: #64748b;">
                    ${brokerageText}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${content}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                Sent via <strong>LeadFlow</strong> on behalf of <strong>${brokerageText}</strong>.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                Need help or have questions? Reply directly to this email or contact <a href="mailto:${advisorEmailText}" style="color: #2563eb; text-decoration: underline;">${advisorEmailText}</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Standard LeadFlow B2B transactional email template for client inquiry confirmations.
 * Built with responsive, table-based layout and dynamic placeholders.
 */
export const DEFAULT_TRANSACTIONAL_EMAIL_TEMPLATE = {
  name: 'New Inquiry Confirmation',
  slug: 'new-inquiry-confirmation',
  subject: 'Welcome to {{brokerage.name}}, {{lead.firstName}}',
  body: `<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <tr>
    <td align="center">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
        <!-- Header -->
        <tr>
          <td style="padding: 24px 32px; border-bottom: 1px solid #e2e8f0;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td align="left" valign="middle">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="background-color: #2563eb; width: 28px; height: 28px; border-radius: 6px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 13px; font-weight: 700; line-height: 28px;">
                        LF
                      </td>
                      <td style="padding-left: 10px; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">
                        LeadFlow
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" valign="middle" style="font-size: 12px; font-weight: 500; color: #64748b;">
                  {{brokerage.name}}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Main Content -->
        <tr>
          <td style="padding: 32px;">
            <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
              Your Mortgage Inquiry Has Been Received
            </h1>
            <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">
              Hi {{lead.firstName}},
            </p>
            <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #334155;">
              Thank you for submitting your mortgage inquiry to <strong>{{brokerage.name}}</strong>. Your dedicated mortgage advisor, <strong>{{advisor.name}}</strong>, has received your application and is reviewing your file.
            </p>

            <!-- Application Details Card -->
            <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding: 5px 0; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; width: 38%;">
                        Applicant
                      </td>
                      <td style="padding: 5px 0; font-size: 13px; font-weight: 600; color: #0f172a;">
                        {{lead.fullName}}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                        Assigned Advisor
                      </td>
                      <td style="padding: 5px 0; font-size: 13px; font-weight: 500; color: #0f172a;">
                        {{advisor.name}}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                        Brokerage
                      </td>
                      <td style="padding: 5px 0; font-size: 13px; font-weight: 500; color: #0f172a;">
                        {{brokerage.name}}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                        Status
                      </td>
                      <td style="padding: 5px 0; font-size: 13px; font-weight: 600; color: #2563eb;">
                        {{stage}}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Call to Action Button -->
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 24px;">
              <tr>
                <td align="center" style="border-radius: 6px; background-color: #2563eb;">
                  <a href="mailto:{{advisor.email}}" target="_blank" style="display: inline-block; padding: 11px 22px; font-size: 13px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                    Contact Your Advisor
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
              We look forward to assisting you with your financing journey.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
              Sent via <strong>LeadFlow</strong> on behalf of <strong>{{brokerage.name}}</strong>.
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
              Questions? Reply directly to this email or reach out to <a href="mailto:{{advisor.email}}" style="color: #2563eb; text-decoration: underline;">{{advisor.email}}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`,
  variables: [
    'lead.firstName',
    'lead.fullName',
    'advisor.name',
    'advisor.email',
    'brokerage.name',
    'stage',
  ],
};
