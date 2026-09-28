import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  validateForm,
  createTriggerFormSchema,
  createEmailTemplateFormSchema,
  updateTriggerStatusSchema,
} from '@/lib/validation'
import {
  renderTemplatePreview,
  extractPlaceholders,
  SAMPLE_TEMPLATE_CONTEXT,
} from '@/features/templates/lib/templatePreview'
import { TriggerItemCard } from '@/features/triggers/components/TriggerItemCard'
import { EmailPreviewModal } from '@/features/templates/components/EmailPreviewModal'
import type { IPipelineTrigger } from '@/types/trigger.types'

describe('Phase 5 — Prompt 2: Automation & Email Tests', () => {
  describe('1. Zod Validation & Schema Logic', () => {
    it('validates a valid task trigger creation payload', () => {
      const validPayload = {
        name: 'Auto-create proposal follow-up',
        toStage: 'PROPOSAL',
        fromStage: 'QUALIFIED',
        actionType: 'CREATE_TASK',
        actionConfig: {
          taskTitle: 'Prepare customized mortgage quotation',
          taskPriority: 'HIGH',
          dueDaysOffset: 2,
        },
        isActive: true,
      }

      const result = validateForm(createTriggerFormSchema, validPayload)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Auto-create proposal follow-up')
        expect(result.data.toStage).toBe('PROPOSAL')
        expect(result.data.actionType).toBe('CREATE_TASK')
      }
    })

    it('rejects trigger creation missing required target stage', () => {
      const invalidPayload = {
        name: 'Incomplete trigger',
        toStage: '', // Empty
        actionType: 'CREATE_TASK',
        actionConfig: {},
      }

      const result = validateForm(createTriggerFormSchema, invalidPayload)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.toStage).toBeDefined()
      }
    })

    it('validates email template creation payload and enforces slug formatting', () => {
      const validTemplate = {
        name: 'Welcome Expat Mortgage Notification',
        slug: 'welcome-expat-mortgage',
        subject: 'Welcome to {{brokerage.name}}, {{lead.firstName}}!',
        body: '<p>Dear {{lead.firstName}}, your advisor {{advisor.name}} will contact you.</p>',
        variables: ['brokerage.name', 'lead.firstName', 'advisor.name'],
        isActive: true,
      }

      const result = validateForm(createEmailTemplateFormSchema, validTemplate)
      expect(result.success).toBe(true)

      // Invalid slug containing uppercase or spaces
      const invalidSlugResult = validateForm(createEmailTemplateFormSchema, {
        ...validTemplate,
        slug: 'INVALID SLUG WITH SPACES',
      })
      expect(invalidSlugResult.success).toBe(false)
      if (!invalidSlugResult.success) {
        expect(invalidSlugResult.errors.slug).toBeDefined()
      }
    })

    it('validates trigger status toggle payload', () => {
      const validToggle = { isActive: false }
      expect(validateForm(updateTriggerStatusSchema, validToggle).success).toBe(true)

      const invalidToggle = { isActive: 'not-a-boolean' }
      expect(validateForm(updateTriggerStatusSchema, invalidToggle).success).toBe(false)
    })
  })

  describe('2. Template Preview & Placeholder Interpolation Logic', () => {
    it('correctly interpolates nested and flat placeholders with Indian borrower context', () => {
      const template =
        'Hello {{lead.firstName}}, welcome to {{brokerage.name}}. Your advisor {{advisor.name}} will review your loan for stage {{newStage}}.'

      const rendered = renderTemplatePreview(template)

      expect(rendered).toContain(SAMPLE_TEMPLATE_CONTEXT.lead.firstName)
      expect(rendered).toContain(SAMPLE_TEMPLATE_CONTEXT.brokerage.name)
      expect(rendered).toContain(SAMPLE_TEMPLATE_CONTEXT.advisor.name)
      expect(rendered).toContain(SAMPLE_TEMPLATE_CONTEXT.newStage)
      expect(rendered).not.toContain('{{')
    })

    it('safely handles missing variables without throwing or crashing', () => {
      const templateWithMissing = 'Hello {{nonExistentVariable}}, your score is {{lead.score}}.'
      const rendered = renderTemplatePreview(templateWithMissing)

      expect(rendered).toContain('[nonExistentVariable]')
      expect(rendered).toContain(String(SAMPLE_TEMPLATE_CONTEXT.lead.score))
    })

    it('defends against prototype traversal and prototype pollution keys', () => {
      const maliciousTemplate = 'Access prototype: {{__proto__.polluted}} and {{constructor.name}}'
      const rendered = renderTemplatePreview(maliciousTemplate)

      expect(rendered).not.toContain('Object')
      expect(rendered).toContain('[__proto__.polluted]')
      expect(rendered).toContain('[constructor.name]')
    })

    it('extracts all unique placeholder variable tokens from text', () => {
      const content =
        'Dear {{lead.firstName}} {{lead.lastName}}, welcome to {{brokerage.name}}. Contact {{advisor.name}} or {{advisor.email}}.'
      const variables = extractPlaceholders(content)

      expect(variables).toEqual([
        'lead.firstName',
        'lead.lastName',
        'brokerage.name',
        'advisor.name',
        'advisor.email',
      ])
    })
  })

  describe('3. RBAC & Security-Sensitive Trigger Behavior', () => {
    const mockTrigger: IPipelineTrigger = {
      _id: 'trigger-123',
      brokerageId: 'brokerage-1',
      name: 'Auto-Task on Qualified',
      fromStage: 'CONTACTED',
      toStage: 'QUALIFIED',
      actionType: 'CREATE_TASK',
      actionConfig: {
        taskTitle: 'Verify CIBIL score & IT returns',
        taskPriority: 'HIGH',
        dueDaysOffset: 1,
      },
      isActive: true,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
    }

    it('renders mutable controls (status toggle switch and delete button) for Brokerage Admins', () => {
      const onToggle = vi.fn()
      const onDelete = vi.fn()

      render(
        <TriggerItemCard
          trigger={mockTrigger}
          canMutate={true}
          onToggleStatus={onToggle}
          onDeleteTrigger={onDelete}
        />,
      )

      // Role switch exists and can be clicked
      const toggleSwitch = screen.getByRole('switch')
      expect(toggleSwitch).toBeInTheDocument()
      fireEvent.click(toggleSwitch)
      expect(onToggle).toHaveBeenCalledWith(mockTrigger)

      // Delete button is present
      const deleteBtn = screen.getByTitle('Delete Trigger Rule')
      expect(deleteBtn).toBeInTheDocument()
      fireEvent.click(deleteBtn)
      expect(onDelete).toHaveBeenCalledWith('trigger-123')
    })

    it('renders read-only view badge and hides mutation actions for Advisors', () => {
      const onToggle = vi.fn()
      const onDelete = vi.fn()

      render(
        <TriggerItemCard
          trigger={mockTrigger}
          canMutate={false} // Advisor role
          onToggleStatus={onToggle}
          onDeleteTrigger={onDelete}
        />,
      )

      // No toggle switch or delete button
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Delete Trigger Rule')).not.toBeInTheDocument()

      // Informative admin-configured badge is shown
      expect(screen.getByText('Brokerage Admin configured')).toBeInTheDocument()
    })
  })

  describe('4. Email Automation Preview & Modal Stability (Regression Test)', () => {
    const mockEmailTrigger: IPipelineTrigger = {
      _id: 'trigger-email-1',
      brokerageId: 'brokerage-1',
      name: 'Send Proposal Email',
      fromStage: 'QUALIFIED',
      toStage: 'PROPOSAL',
      actionType: 'SEND_EMAIL',
      actionConfig: {
        templateId: {
          _id: 'tpl-1',
          name: 'Proposal Notification',
          slug: 'proposal-notification',
          subject: 'Your Home Loan Proposal: {{lead.fullName}}',
        },
        recipientType: 'LEAD',
      },
      isActive: true,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
    }

    it('renders Preview Email button and invokes onPreviewTemplate on click', () => {
      const onPreview = vi.fn()

      render(
        <TriggerItemCard
          trigger={mockEmailTrigger}
          canMutate={true}
          onToggleStatus={vi.fn()}
          onPreviewTemplate={onPreview}
        />,
      )

      const previewBtn = screen.getByRole('button', { name: /Preview Email/i })
      expect(previewBtn).toBeInTheDocument()
      fireEvent.click(previewBtn)

      expect(onPreview).toHaveBeenCalledTimes(1)
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Proposal Notification',
          slug: 'proposal-notification',
        }),
      )
    })

    it('renders EmailPreviewModal safely across state transitions without React hook errors', () => {
      const onClose = vi.fn()

      // 1. Initial closed state (template is null) — previously caused early return before useMemo
      const { rerender } = render(
        <EmailPreviewModal
          isOpen={false}
          onClose={onClose}
          template={null}
        />,
      )

      expect(screen.queryByText('Email Template Preview')).not.toBeInTheDocument()

      // 2. Open state with valid template — hook count must match initial render exactly
      rerender(
        <EmailPreviewModal
          isOpen={true}
          onClose={onClose}
          template={{
            name: 'Proposal Notification',
            slug: 'proposal-notification',
            subject: 'Dear {{lead.firstName}}, your proposal is ready',
            body: '<p>Hello {{lead.firstName}}, welcome to {{brokerage.name}}.</p>',
          }}
        />,
      )

      expect(screen.getByText('Proposal Notification')).toBeInTheDocument()
      expect(screen.getByText(/Dear Rahul, your proposal is ready/i)).toBeInTheDocument()

      // 3. Return to closed state
      rerender(
        <EmailPreviewModal
          isOpen={false}
          onClose={onClose}
          template={null}
        />,
      )

      expect(screen.queryByText('Proposal Notification')).not.toBeInTheDocument()
    })

    it('gracefully handles missing or invalid preview fields without crashing', () => {
      render(
        <EmailPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          template={{
            name: '',
            subject: '',
            body: '',
          }}
        />,
      )

      // Renders with safe default fallbacks instead of crashing
      expect(screen.getByText('Email Template Preview')).toBeInTheDocument()
      expect(screen.getByText('(No Subject)')).toBeInTheDocument()
      expect(screen.getByText('No preview content available')).toBeInTheDocument()
    })
  })
})
