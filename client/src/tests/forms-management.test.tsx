import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { IForm } from '@/types/form.types'
import type { AuthContextValue } from '@/features/auth/auth-context'
import type { AuthUser } from '@/types/auth.types'
import * as AuthHook from '@/hooks/useAuth'
import * as FormsApi from '@/features/forms/api/forms.api'
import { FormsPage } from '@/features/forms/FormsPage'
import { FormMetricsStrip } from '@/features/forms/components/FormMetricsStrip'
import { FormCard } from '@/features/forms/components/FormCard'
import { FormBuilderModal } from '@/features/forms/components/FormBuilderModal'
import { FormPreviewModal } from '@/features/forms/components/FormPreviewModal'
import {
  validateForm,
  createFormClientSchema,
  updateFormClientSchema,
  formFieldClientSchema,
} from '@/lib/validation'

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}))

describe('Phase 2 — Forms Management UI Tests', () => {
  let queryClient: QueryClient

  const mockAdmin: AuthUser = {
    id: 'admin-1',
    email: 'admin@leadflow.in',
    name: 'Brokerage Admin',
    role: 'BROKERAGE_ADMIN',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const mockAdvisor: AuthUser = {
    id: 'advisor-1',
    email: 'advisor@leadflow.in',
    name: 'Loan Advisor',
    role: 'ADVISOR',
    status: 'ACTIVE',
    brokerageId: 'brokerage-1',
  }

  const createMockAuth = (user: AuthUser | null): AuthContextValue => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })

  const sampleForms: IForm[] = [
    {
      _id: 'form-1',
      brokerageId: 'brokerage-1',
      title: 'NRI Home Loan Inquiry',
      slug: 'nri-home-loan',
      description: 'Quick pre-qualification questionnaire for expat home buyers.',
      status: 'PUBLISHED',
      fields: [
        {
          fieldKey: 'applicant_name',
          label: 'Applicant Name',
          type: 'text',
          required: true,
          order: 0,
          placeholder: 'Full legal name',
        },
        {
          fieldKey: 'email_address',
          label: 'Email Address',
          type: 'email',
          required: true,
          order: 1,
          placeholder: 'name@example.com',
        },
        {
          fieldKey: 'loan_amount',
          label: 'Desired Loan Amount',
          type: 'number',
          required: false,
          order: 2,
          placeholder: '5000000',
        },
        {
          fieldKey: 'property_city',
          label: 'Property City',
          type: 'select',
          required: true,
          order: 3,
          options: ['Mumbai', 'Bengaluru', 'Delhi NCR', 'Hyderabad'],
        },
      ],
      submitButtonText: 'Apply for Pre-Approval',
      successMessage: 'Thank you! An advisor will review your application within 24 hours.',
      submissionCount: 42,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'form-2',
      brokerageId: 'brokerage-1',
      title: 'Commercial Mortgages Draft',
      slug: 'commercial-mortgage',
      description: 'Internal draft for commercial loan intake.',
      status: 'DRAFT',
      fields: [
        {
          fieldKey: 'business_name',
          label: 'Company Name',
          type: 'text',
          required: true,
          order: 0,
        },
        {
          fieldKey: 'project_notes',
          label: 'Project Summary',
          type: 'textarea',
          required: false,
          order: 1,
        },
      ],
      submitButtonText: 'Submit Inquiry',
      successMessage: 'We received your inquiry.',
      submissionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'form-3',
      brokerageId: 'brokerage-1',
      title: 'Archived 2025 Campaign',
      slug: 'campaign-2025',
      status: 'ARCHIVED',
      fields: [],
      submitButtonText: 'Submit',
      successMessage: 'Thanks.',
      submissionCount: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
    vi.restoreAllMocks()
    vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdmin))
  })

  describe('1. Zod Validation & Schema Logic', () => {
    it('validates a valid form creation payload', () => {
      const validPayload = {
        title: 'Home Loan Inquiry',
        slug: 'home-loan-inquiry',
        description: 'Intake form',
        status: 'DRAFT',
        fields: [
          {
            fieldKey: 'applicant_name',
            label: 'Applicant Name',
            type: 'text',
            required: true,
            order: 0,
          },
          {
            fieldKey: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            order: 1,
          },
        ],
        submitButtonText: 'Submit Application',
        successMessage: 'We received your application.',
      }

      const result = validateForm(createFormClientSchema, validPayload)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Home Loan Inquiry')
        expect(result.data.slug).toBe('home-loan-inquiry')
        expect(result.data.fields).toHaveLength(2)
      }
    })

    it('rejects form with invalid slug containing spaces or uppercase characters', () => {
      const invalidPayload = {
        title: 'Home Loan',
        slug: 'Invalid Slug!',
        fields: [],
      }

      const result = validateForm(createFormClientSchema, invalidPayload)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.slug).toBeDefined()
      }
    })

    it('rejects duplicate field keys within the same form', () => {
      const payloadWithDuplicates = {
        title: 'Loan Intake',
        slug: 'loan-intake',
        fields: [
          {
            fieldKey: 'phone_number',
            label: 'Mobile Phone',
            type: 'phone',
            required: true,
            order: 0,
          },
          {
            fieldKey: 'phone_number', // Duplicate key!
            label: 'Secondary Phone',
            type: 'phone',
            required: false,
            order: 1,
          },
        ],
      }

      const result = validateForm(createFormClientSchema, payloadWithDuplicates)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.fields).toContain('unique')
      }
    })

    it('validates partial update payload using updateFormClientSchema', () => {
      const partialUpdate = {
        title: 'Updated Form Title',
        status: 'PUBLISHED' as const,
      }
      const result = validateForm(updateFormClientSchema, partialUpdate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated Form Title')
        expect(result.data.status).toBe('PUBLISHED')
      }
    })

    it('validates individual field schema and rejects unsupported types', () => {
      const validField = {
        fieldKey: 'loan_amount',
        label: 'Loan Amount',
        type: 'number',
        required: true,
        order: 0,
        placeholder: 'e.g. 5000000',
      }
      expect(validateForm(formFieldClientSchema, validField).success).toBe(true)

      const invalidField = {
        fieldKey: 'attachment_doc',
        label: 'Document',
        type: 'file', // Unsupported type!
        required: false,
        order: 1,
      }
      expect(validateForm(formFieldClientSchema, invalidField).success).toBe(false)
    })
  })

  describe('2. KPI Metrics Strip & Cards Rendering', () => {
    it('calculates and renders correct KPI aggregates (Total, Published, Drafts, Submissions)', () => {
      render(<FormMetricsStrip forms={sampleForms} />)

      // Total Forms: 3
      expect(screen.getByText('Total Forms')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()

      // Published: 1 and Drafts: 1
      expect(screen.getByText('Published')).toBeInTheDocument()
      expect(screen.getByText('Drafts')).toBeInTheDocument()
      expect(screen.getAllByText('1')).toHaveLength(2)

      // Total Submissions: 42 + 0 + 15 = 57
      expect(screen.getByText('Submissions')).toBeInTheDocument()
      expect(screen.getByText('57')).toBeInTheDocument()
    })

    it('renders form card with proper status badge, fields count, and submission stats', () => {
      const onPreview = vi.fn()
      const onEdit = vi.fn()

      render(
        <FormCard
          form={sampleForms[0]}
          canMutate={true}
          brokerageIdentifier="berlin-capital"
          onPreview={onPreview}
          onEdit={onEdit}
        />,
      )

      expect(screen.getByText('NRI Home Loan Inquiry')).toBeInTheDocument()
      expect(screen.getByText('/nri-home-loan')).toBeInTheDocument()
      expect(screen.getByText('PUBLISHED')).toBeInTheDocument()
      expect(screen.getByText('4 Fields')).toBeInTheDocument()
      expect(screen.getByText('42 Submissions')).toBeInTheDocument()

      // First 4 field chips
      expect(screen.getByText('Applicant Name')).toBeInTheDocument()
      expect(screen.getByText('Email Address')).toBeInTheDocument()
    })

    it('copies public form link with toast feedback', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      })

      render(
        <FormCard
          form={sampleForms[0]}
          canMutate={true}
          brokerageIdentifier="berlin-capital"
          onPreview={vi.fn()}
        />,
      )

      const copyBtn = screen.getByRole('button', { name: /copy link/i })
      fireEvent.click(copyBtn)

      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/forms/public/berlin-capital/nri-home-loan'),
      )
      await waitFor(() => {
        expect(screen.getByText('Copied')).toBeInTheDocument()
      })
    })
  })

  describe('3. Form Preview Modal (Interactive Local Preview)', () => {
    it('renders form preview with inputs, select options, and submit button in defined order', () => {
      render(
        <FormPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          form={sampleForms[0]}
          brokerageIdentifier="berlin-capital"
        />,
      )

      expect(screen.getByText('Form Preview')).toBeInTheDocument()
      expect(screen.getByText('NRI Home Loan Inquiry')).toBeInTheDocument()

      // Inputs rendered
      expect(screen.getByPlaceholderText('Full legal name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument()

      // Select options
      expect(screen.getByText('Mumbai')).toBeInTheDocument()
      expect(screen.getByText('Bengaluru')).toBeInTheDocument()

      // Submit button text from form definition
      expect(screen.getByRole('button', { name: /apply for pre-approval/i })).toBeInTheDocument()
    })

    it('enforces required field validation in local interactive preview', async () => {
      render(
        <FormPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          form={sampleForms[0]}
        />,
      )

      const submitBtn = screen.getByRole('button', { name: /apply for pre-approval/i })
      fireEvent.click(submitBtn)

      // Shows required errors without submitting
      await waitFor(() => {
        expect(screen.getByText(/applicant name is required/i)).toBeInTheDocument()
      })
    })

    it('displays mock submission success message on valid submission test', async () => {
      render(
        <FormPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          form={sampleForms[0]}
        />,
      )

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText('Full legal name'), {
        target: { value: 'Arjun Das' },
      })
      fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
        target: { value: 'arjun@example.com' },
      })

      // Select city
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'Bengaluru' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /apply for pre-approval/i }))

      // Verify success message appears
      await waitFor(() => {
        expect(screen.getByText('Submission Received')).toBeInTheDocument()
        expect(
          screen.getByText(/thank you! an advisor will review your application/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe('4. Form Builder Modal (Field Sequence & Ordering)', () => {
    it('moves fields up and down, recomputing contiguous order', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <FormBuilderModal
            isOpen={true}
            onClose={vi.fn()}
            form={sampleForms[0]}
          />
        </QueryClientProvider>,
      )

      // Switch to Fields tab
      fireEvent.click(screen.getByRole('button', { name: /form fields/i }))

      // 4 fields should be listed
      expect(screen.getByText('Applicant Name')).toBeInTheDocument()
      expect(screen.getByText('Email Address')).toBeInTheDocument()

      // Move Down on first field
      const moveDownButtons = screen.getAllByTitle('Move Down')
      fireEvent.click(moveDownButtons[0])

      // After move down, email_address should precede applicant_name
      const fieldKeys = screen.getAllByText(/key: (applicant_name|email_address)/)
      expect(fieldKeys[0]).toHaveTextContent('key: email_address')
      expect(fieldKeys[1]).toHaveTextContent('key: applicant_name')
    })

    it('rejects duplicate field key when adding a new field in builder', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <FormBuilderModal
            isOpen={true}
            onClose={vi.fn()}
            form={sampleForms[0]}
          />
        </QueryClientProvider>,
      )

      // Switch to Fields tab
      fireEvent.click(screen.getByRole('button', { name: /form fields/i }))

      // Click Add Field
      fireEvent.click(screen.getByRole('button', { name: /add field/i }))

      // Enter label and existing fieldKey
      fireEvent.change(screen.getByPlaceholderText('e.g. Loan Amount Needed'), {
        target: { value: 'Duplicate Key Test' },
      })
      fireEvent.change(screen.getByPlaceholderText('e.g. loan_amount'), {
        target: { value: 'applicant_name' }, // Already exists on form-1!
      })

      // Click Insert Field
      fireEvent.click(screen.getByRole('button', { name: /insert field/i }))

      // Should display duplicate error
      await waitFor(() => {
        expect(
          screen.getByText(/a field with key "applicant_name" already exists/i),
        ).toBeInTheDocument()
      })
    })
  })

  describe('5. RBAC & Advisor Read-Only Protection', () => {
    it('renders Create Form, Edit, Publish, and Archive actions for BROKERAGE_ADMIN', async () => {
      vi.spyOn(FormsApi.formsApi, 'getForms').mockResolvedValue(sampleForms)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <FormsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('NRI Home Loan Inquiry')).toBeInTheDocument()
      })

      // Create Form button visible
      expect(screen.getByRole('button', { name: /create form/i })).toBeInTheDocument()

      // Edit and Archive buttons visible
      expect(screen.getAllByRole('button', { name: /edit/i })[0]).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /archive/i })[0]).toBeInTheDocument()
    })

    it('restricts ADVISOR to read-only: hides Create Form, Edit, and Archive actions', async () => {
      vi.spyOn(AuthHook, 'useAuth').mockReturnValue(createMockAuth(mockAdvisor))
      vi.spyOn(FormsApi.formsApi, 'getForms').mockResolvedValue(sampleForms)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <FormsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('NRI Home Loan Inquiry')).toBeInTheDocument()
      })

      // Create Form button hidden for Advisor
      expect(screen.queryByRole('button', { name: /create form/i })).not.toBeInTheDocument()

      // Edit and Archive buttons hidden for Advisor
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument()

      // Preview and Copy Link remain accessible for Advisor
      expect(screen.getAllByRole('button', { name: /preview/i })[0]).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /copy link/i })[0]).toBeInTheDocument()
    })

    it('opens ConfirmModal with "Archive Form" (never "Delete Form") when archive is clicked', async () => {
      vi.spyOn(FormsApi.formsApi, 'getForms').mockResolvedValue(sampleForms)

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <FormsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByText('NRI Home Loan Inquiry')).toBeInTheDocument()
      })

      // Click archive button on first card
      const archiveButtons = screen.getAllByRole('button', { name: /archive/i })
      fireEvent.click(archiveButtons[0])

      // Confirm modal opens with explicit "Archive Form" wording
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Archive Form' })).toBeInTheDocument()
        expect(screen.getByText(/are you sure you want to archive/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Archive Form' })).toBeInTheDocument()
      })
      expect(screen.queryByText(/delete form/i)).not.toBeInTheDocument()
    })
  })
})
