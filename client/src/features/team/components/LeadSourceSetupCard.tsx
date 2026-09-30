import * as React from 'react'
import {
  FileSpreadsheet,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  Code2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { getApiOrigin } from '@/lib/api'
import { useBrokerageDetails } from '../api/team.api'

export function LeadSourceSetupCard() {
  const { user } = useAuth()
  const brokerageId = user?.brokerageId || ''

  const { data: brokerage, isLoading } = useBrokerageDetails(brokerageId)

  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [showSecret, setShowSecret] = React.useState(false)
  const [customDomain, setCustomDomain] = React.useState('')
  const [isEditingDomain, setIsEditingDomain] = React.useState(false)

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const apiOrigin = getApiOrigin()
  const effectiveOrigin = (customDomain.trim() || apiOrigin).replace(/\/$/, '')
  const webhookUrl = `${effectiveOrigin}/api/leads/webhook/${brokerageId}`
  const webhookSecret = brokerage?.webhookSecret || ''

  const googleAppsScriptCode = `/**
 * ==============================================================================
 * LeadFlow — Google Forms to Mortgage Pipeline Webhook Forwarder
 * ==============================================================================
 * Automatically triggered on every Google Form submission.
 * Validates responses, computes lead qualification score, and forwards lead
 * payload to your LeadFlow brokerage webhook endpoint.
 */

var CONFIG = {
  WEBHOOK_URL: PropertiesService.getScriptProperties().getProperty('LEADFLOW_WEBHOOK_URL') ||
    '${webhookUrl}',
  WEBHOOK_SECRET: PropertiesService.getScriptProperties().getProperty('LEADFLOW_WEBHOOK_SECRET') ||
    '${webhookSecret || 'YOUR_BROKERAGE_WEBHOOK_SECRET'}'
};

// ==============================================================================
// FORM SUBMIT EVENT HANDLER
// ==============================================================================
function onFormSubmit(e) {
  try {
    var itemResponses = e.response.getItemResponses();
    var answers = {};

    // Build title-to-response lookup map
    for (var i = 0; i < itemResponses.length; i++) {
      var title = itemResponses[i].getItem().getTitle().trim();
      var answer = itemResponses[i].getResponse();
      answers[title] = answer;
    }

    // Helper: Find answer by title keywords (case-insensitive)
    function getAnswer(keywords) {
      for (var key in answers) {
        var lower = key.toLowerCase();
        for (var k = 0; k < keywords.length; k++) {
          if (lower.indexOf(keywords[k]) !== -1) {
            return answers[key];
          }
        }
      }
      return null;
    }

    // Helper: Parse numerical fields from strings (strips ₹, commas, spaces)
    function parseRupees(val) {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      var cleaned = String(val).replace(/[^0-9.]/g, '');
      var parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : Math.round(parsed);
    }

    // 1. Extract Full Name (Supports separate First/Last Name or combined Full Name)
    var firstName = (getAnswer(['first name', 'firstname', 'given name']) || '').toString().trim();
    var lastName = (getAnswer(['last name', 'lastname', 'surname', 'family name']) || '').toString().trim();
    if (!firstName && !lastName) {
      var rawName = (getAnswer(['full name', 'borrower name', 'applicant name', 'name']) || '').toString().trim();
      if (rawName) {
        var nameParts = String(rawName).trim().split(/\\s+/);
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ');
      }
    }
    if (!firstName) firstName = 'Applicant';

    // 2. Extract Contact Info
    var email = (getAnswer(['email']) || '').toString().trim().toLowerCase();
    var phone = (getAnswer(['phone', 'mobile', 'contact']) || '').toString().trim();
    var city = (getAnswer(['city', 'location']) || '').toString().trim();

    // 3. Extract Property & Financial Fields
    var propertyType = (getAnswer(['property type', 'property category']) || '').toString().trim();
    var loanAmount = parseRupees(getAnswer(['loan amount', 'target loan', 'home loan']));
    var propertyValue = parseRupees(getAnswer(['property value', 'valuation']));
    var grossIncome = parseRupees(getAnswer(['monthly gross income', 'gross monthly', 'monthly income', 'salary', 'income']));
    var employmentType = (getAnswer(['employment type', 'employment', 'occupation']) || 'Salaried').toString().trim();
    var preferredContactTime = (getAnswer(['preferred contact time', 'contact time', 'preferred time']) || '').toString().trim();
    var additionalInfo = (getAnswer(['additional information', 'additional info', 'comments', 'remarks']) || '').toString().trim();

    // 4. Compute Lead Quality Score (0 - 100)
    var score = 10; // Submission baseline
    if (email && email.indexOf('@') !== -1) score += 20;
    if (phone && phone.length >= 8) score += 20;
    if (loanAmount > 0) score += 20;
    if (grossIncome > 0) score += 15;
    if (propertyValue > 0) score += 15;
    if (score > 100) score = 100;

    // 5. Construct Structured Inquiry Notes
    var noteParts = ['Ingested via Google Forms (Home Loan Enquiry) • City: ' + (city || 'Not specified')];
    if (propertyType) noteParts.push('Property Type: ' + propertyType);
    if (preferredContactTime) noteParts.push('Preferred Contact Time: ' + preferredContactTime);
    if (additionalInfo) noteParts.push('Applicant Remarks: ' + additionalInfo);
    var notes = noteParts.join(' • ');

    // 6. Construct Standard LeadFlow Payload
    var payload = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone || undefined,
      source: 'WEBSITE',
      score: score,
      notes: notes,
      customFields: {
        provider: 'GOOGLE_FORMS',
        loanAmount: loanAmount,
        propertyValue: propertyValue,
        monthlyGrossIncome: grossIncome,
        monthlyIncome: grossIncome,
        propertyCity: city,
        propertyType: propertyType || undefined,
        employmentType: employmentType,
        preferredContactTime: preferredContactTime || undefined,
        additionalInfo: additionalInfo || undefined,
        submittedAt: new Date().toISOString()
      }
    };

    // 6. Deliver to LeadFlow Webhook Endpoint
    var timestamp = Math.floor(Date.now() / 1000).toString();
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-webhook-secret': CONFIG.WEBHOOK_SECRET,
        'x-webhook-timestamp': timestamp
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();

    Logger.log('LeadFlow Response Code: ' + responseCode);
    Logger.log('LeadFlow Response Body: ' + responseBody);

    if (responseCode !== 200 && responseCode !== 201) {
      throw new Error('LeadFlow webhook failed with HTTP ' + responseCode + ': ' + responseBody);
    }
  } catch (err) {
    Logger.log('Error in onFormSubmit: ' + err.toString());
  }
}`

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="rounded-xl border border-border/80 bg-white p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Google Forms & External Lead Source Setup
            </h2>
            <p className="text-xs text-muted-foreground">
              Automatically connect your borrower enquiry forms directly to your mortgage pipeline.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed pt-1">
          When home loan applicants submit your custom Google Form, LeadFlow securely ingests the response, calculates loan qualification metrics, matches existing borrowers, and places the inquiry directly into your advisor pipeline in real time.
        </p>
      </div>

      {/* Integration Credentials Section */}
      <Card className="p-5 border-border/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Your Ingestion Credentials
            </h3>
          </div>
          <Badge variant="default" size="sm">
            Active Integration
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded" />
            <Skeleton className="h-12 w-full rounded" />
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Brokerage ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Brokerage Identifier (Tenant ID)
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(brokerageId, 'brokerageId')}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  {copiedField === 'brokerageId' ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedField === 'brokerageId' ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200 text-xs font-mono text-slate-800 truncate">
                {brokerageId}
              </div>
            </div>

            {/* Webhook Ingestion URL */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Webhook Ingestion URL (Backend API)
                </label>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingDomain(!isEditingDomain)}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                  >
                    {isEditingDomain ? 'Cancel Custom URL' : 'Override Host/Tunnel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookUrl, 'webhookUrl')}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    {copiedField === 'webhookUrl' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedField === 'webhookUrl' ? 'Copied' : 'Copy URL'}</span>
                  </button>
                </div>
              </div>
              {isEditingDomain && (
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="e.g. https://leadflow-api.onrender.com or https://your-tunnel.ngrok-free.app"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Custom backend domain or ngrok tunnel to embed in your webhook destination.
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200 text-xs font-mono text-slate-800 break-all">
                {webhookUrl}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                The secure HTTP destination for your Google Apps Script webhook trigger.
              </p>
            </div>

            {/* Webhook Secret */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Webhook Authentication Secret
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showSecret ? 'Hide Secret' : 'Reveal Secret'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookSecret, 'webhookSecret')}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                  >
                    {copiedField === 'webhookSecret' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedField === 'webhookSecret' ? 'Copied' : 'Copy Secret'}</span>
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200 text-xs font-mono text-slate-800">
                {showSecret
                  ? webhookSecret
                  : webhookSecret
                  ? '••••••••••••••••••••••••••••••••••••••••••••••••'
                  : 'Secret not available'}
              </div>
            </div>

            {/* Confidentiality Callout */}
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-950 leading-relaxed flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Confidentiality Guidance: </span>
                Treat this webhook secret with the same confidentiality as a banking password. It verifies that form submissions originate strictly from your verified Google Form. Never post this secret in public documents.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Google Apps Script Code (Code.gs) Section */}
      <Card className="p-5 border-border/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Google Apps Script Code (Code.gs)
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(googleAppsScriptCode, 'scriptCode')}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            {copiedField === 'scriptCode' ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Script Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Apps Script</span>
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          This script is pre-populated with your verified Webhook Ingestion URL and Webhook Secret. Copy and paste it directly into your Google Form's Apps Script editor (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">Code.gs</code>).
        </p>

        <div className="relative rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-100 overflow-x-auto max-h-[380px] overflow-y-auto">
          <pre className="whitespace-pre">{googleAppsScriptCode}</pre>
        </div>
      </Card>

      {/* 4-Step Setup Guide */}
      <Card className="p-5 border-border/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Quick 4-Step Connection Guide
          </h3>
        </div>

        <ol className="space-y-4 text-xs text-slate-700">
          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              1
            </span>
            <div>
              <strong className="text-slate-900 font-semibold block">
                Open Google Form Apps Script
              </strong>
              <span>
                In your Google Form editor, click the three-dots menu in the top right, then select{' '}
                <strong className="text-slate-900">Apps Script</strong> to open the script editor.
              </span>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              2
            </span>
            <div>
              <strong className="text-slate-900 font-semibold block">
                Paste Apps Script Code
              </strong>
              <span>
                Replace any existing code in <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">Code.gs</code> with the pre-configured script from the card above and click <strong className="text-slate-900">Save</strong>.
              </span>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              3
            </span>
            <div>
              <strong className="text-slate-900 font-semibold block">
                Add Form Submission Trigger
              </strong>
              <span>
                In Apps Script, click <strong className="text-slate-900">Triggers</strong> (alarm clock icon on left), click <strong className="text-slate-900">Add Trigger</strong> in bottom right, set function to <strong className="text-slate-900">onFormSubmit</strong>, and set event type to <strong className="text-slate-900">On form submit</strong>.
              </span>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              4
            </span>
            <div>
              <strong className="text-slate-900 font-semibold block">
                Submit Test & Verify Pipeline Ingestion
              </strong>
              <span>
                Submit a test response through your live Google Form. It will appear instantaneously in the <strong className="text-slate-900">NEW</strong> column on your advisor Kanban pipeline with qualification scores and automatic notification tasks.
              </span>
            </div>
          </li>
        </ol>
      </Card>

      {/* Recommended Form Fields Reference */}
      <Card className="p-5 border-border/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Recommended Form Field Question Titles
          </h3>
        </div>

        <p className="text-xs text-muted-foreground">
          For seamless automated parsing, configure the following 12 questions in your Google Form:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">1. First Name *</span>
            <span className="text-[11px] text-muted-foreground">Applicant given name (e.g. Rahul)</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">2. Last Name *</span>
            <span className="text-[11px] text-muted-foreground">Applicant surname (e.g. Sharma)</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">3. Email Address *</span>
            <span className="text-[11px] text-muted-foreground">Primary applicant email address</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">4. Phone Number *</span>
            <span className="text-[11px] text-muted-foreground">Mobile contact number with prefix</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">5. City *</span>
            <span className="text-[11px] text-muted-foreground">Target location (e.g. Mumbai, Bengaluru)</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">6. Property Type *</span>
            <span className="text-[11px] text-muted-foreground">Apartment, House, Villa, Plot, etc.</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">7. Property Value *</span>
            <span className="text-[11px] text-muted-foreground">Estimated valuation in INR ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">8. Loan Amount *</span>
            <span className="text-[11px] text-muted-foreground">Requested home loan in INR ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">9. Monthly Gross Income *</span>
            <span className="text-[11px] text-muted-foreground">Gross applicant earnings in INR ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">10. Employment Type *</span>
            <span className="text-[11px] text-muted-foreground">Salaried, Self-Employed, Business Owner</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">11. Preferred Contact Time</span>
            <span className="text-[11px] text-muted-foreground">Morning, Afternoon, Evening, Anytime</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">12. Additional Information</span>
            <span className="text-[11px] text-muted-foreground">Applicant remarks or special financing notes</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
