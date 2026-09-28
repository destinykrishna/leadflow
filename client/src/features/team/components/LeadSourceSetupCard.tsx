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
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useBrokerageDetails } from '../api/team.api'

export function LeadSourceSetupCard() {
  const { user } = useAuth()
  const brokerageId = user?.brokerageId || ''

  const { data: brokerage, isLoading } = useBrokerageDetails(brokerageId)

  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [showSecret, setShowSecret] = React.useState(false)

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const webhookUrl = `${window.location.origin}/api/leads/webhook/${brokerageId}`
  const webhookSecret = brokerage?.webhookSecret || ''

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
                  Webhook Ingestion URL
                </label>
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
                Configure Project Script Properties
              </strong>
              <span>
                In the left navigation bar of Apps Script, click <strong className="text-slate-900">Project Settings</strong> (gear icon), scroll to <strong className="text-slate-900">Script Properties</strong>, and click <strong className="text-slate-900">Add script property</strong> for each:
              </span>
              <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-800">
                <div className="flex items-center justify-between">
                  <span>LEADFLOW_WEBHOOK_URL = [Your Webhook Ingestion URL above]</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>LEADFLOW_WEBHOOK_SECRET = [Your Webhook Secret above]</span>
                </div>
              </div>
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
                Paste your Apps Script lead forwarder code into <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">Code.gs</code>. Then go to <strong className="text-slate-900">Triggers</strong> (alarm clock icon), click <strong className="text-slate-900">Add Trigger</strong>, and set event type to <strong className="text-slate-900">On form submit</strong>.
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
          For seamless automated parsing, use the following question titles in your Google Form:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Full Name</span>
            <span className="text-[11px] text-muted-foreground">e.g. Rahul Sharma</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Email Address</span>
            <span className="text-[11px] text-muted-foreground">Primary applicant email</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Phone Number</span>
            <span className="text-[11px] text-muted-foreground">Mobile contact number</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Target Loan Amount</span>
            <span className="text-[11px] text-muted-foreground">Home loan request in INR ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Property Value</span>
            <span className="text-[11px] text-muted-foreground">Estimated property value ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Monthly Income</span>
            <span className="text-[11px] text-muted-foreground">Gross monthly earnings ₹</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Property City</span>
            <span className="text-[11px] text-muted-foreground">e.g. Mumbai, Bengaluru</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="font-semibold text-slate-900 block">Employment Type</span>
            <span className="text-[11px] text-muted-foreground">Salaried / Self-Employed</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
