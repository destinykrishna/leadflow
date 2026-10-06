import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AxiosError, type AxiosResponse } from 'axios'
import type { IPublicFormView, IForm } from '@/types/form.types'
import { publicFormApi } from '@/features/forms/public/public-form.api'
import { PublicFormPage } from '@/features/forms/public/PublicFormPage'
import { FormCard } from '@/features/forms/components/FormCard'
import { FormPreviewModal } from '@/features/forms/components/FormPreviewModal'

describe('Public Forms — Unauthenticated Experience & Pipeline Integration', () => {
  let queryClient: QueryClient

  const mockPublicForm: IPublicFormView = {
    id: 'form-123',
    brokerageId: 'brokerage-berlin',
    brokerageName: 'Berlin Capital Mortgages',
    title: 'Expat Mortgage Pre-Qualification',
    slug: 'pre-qual',
    description: 'Get an initial assessment of your borrowing capacity in Germany.',
    fields: [
      {
        fieldKey: 'fullName',
        label: 'Full Name',
        type: 'text',
        required: true,
        order: 0,
        placeholder: 'e.g. Maria Weber',
        helpText: 'As stated on your official ID',
      },
      {
        fieldKey: 'email',
        label: 'Work or Personal Email',
        type: 'email',
        required: true,
        order: 1,
        placeholder: 'maria@example.com',
      },
      {
        fieldKey: 'phone',
        label: 'Mobile Phone',
        type: 'phone',
        required: false,
        order: 2,
        placeholder: '+49 170 1234567',
      },
      {
        fieldKey: 'loanAmount',
        label: 'Desired Loan Amount (€)',
        type: 'number',
        required: false,
        order: 3,
        placeholder: '350000',
        helpText: 'Estimated mortgage requirement',
      },
      {
        fieldKey: 'propertyType',
        label: 'Property Type',
        type: 'select',
        required: false,
        order: 4,
        placeholder: 'Select property type...',
        options: ['Apartment / Condo', 'Single Family Home', 'Multi-Family Investment'],
      },
      {
        fieldKey: 'notes',
        label: 'Additional Comments',
        type: 'textarea',
        required: false,
        order: 5,
        placeholder: 'Any special requirements or timeline...',
      },
    ],
    submitButtonText: 'Submit Assessment',
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    })
  })

  function renderPublicFormPage(
    brokerageIdentifier = 'berlin-capital',
    slug = 'pre-qual',
  ) {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/forms/${brokerageIdentifier}/${slug}`]}>
          <Routes>
            <Route
              path="/forms/:brokerageIdentifier/:slug"
              element={<PublicFormPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('renders loading state initially and then displays form definition with all 6 field types', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)

    renderPublicFormPage()

    // Loading indicator
    expect(screen.getByText(/loading form/i)).toBeInTheDocument()

    // Content loaded
    await waitFor(() => {
      expect(screen.getByText('Expat Mortgage Pre-Qualification')).toBeInTheDocument()
    })

    // Brokerage badge
    expect(screen.getByText('Berlin Capital Mortgages')).toBeInTheDocument()
    expect(
      screen.getByText('Get an initial assessment of your borrowing capacity in Germany.'),
    ).toBeInTheDocument()

    // Verify all 6 field types are rendered
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument() // text
    expect(screen.getByLabelText(/work or personal email/i)).toBeInTheDocument() // email
    expect(screen.getByLabelText(/mobile phone/i)).toBeInTheDocument() // phone
    expect(screen.getByLabelText(/desired loan amount/i)).toBeInTheDocument() // number
    expect(screen.getByLabelText(/property type/i)).toBeInTheDocument() // select
    expect(screen.getByLabelText(/additional comments/i)).toBeInTheDocument() // textarea

    // Verify select options
    expect(screen.getByRole('option', { name: 'Apartment / Condo' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Single Family Home' }),
    ).toBeInTheDocument()

    // Verify configured submit button text
    expect(
      screen.getByRole('button', { name: /submit assessment/i }),
    ).toBeInTheDocument()

    // Verify document.title dynamic sync
    expect(document.title).toContain('Expat Mortgage Pre-Qualification')
    expect(document.title).toContain('Berlin Capital Mortgages')
  })

  it('validates required fields client-side before triggering network submission', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)
    const submitSpy = vi.spyOn(publicFormApi, 'submitPublicForm')

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByText('Expat Mortgage Pre-Qualification')).toBeInTheDocument()
    })

    // Click submit without filling in required Full Name and Email
    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    // Inline errors should be rendered
    await waitFor(() => {
      expect(screen.getByText('Full Name is required')).toBeInTheDocument()
      expect(screen.getByText('Work or Personal Email is required')).toBeInTheDocument()
    })

    // Network mutation was never called
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('validates email format client-side', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)
    const submitSpy = vi.spyOn(publicFormApi, 'submitPublicForm')

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Alex Expat' },
    })
    fireEvent.change(screen.getByLabelText(/work or personal email/i), {
      target: { value: 'not-a-valid-email' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })

    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('validates numeric fields client-side', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)
    const submitSpy = vi.spyOn(publicFormApi, 'submitPublicForm')

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Alex Expat' },
    })
    fireEvent.change(screen.getByLabelText(/work or personal email/i), {
      target: { value: 'alex@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/desired loan amount/i), {
      target: { value: 'non-numeric' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Desired Loan Amount (€) must be a valid number'),
      ).toBeInTheDocument()
    })

    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('successfully submits valid form responses and displays the backend-provided success message', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)
    const submitSpy = vi.spyOn(publicFormApi, 'submitPublicForm').mockResolvedValue({
      success: true,
      message: 'Thank you! A senior mortgage advisor will contact you within 24 hours.',
    })

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    // Fill in values
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Maria Weber' },
    })
    fireEvent.change(screen.getByLabelText(/work or personal email/i), {
      target: { value: 'maria.weber@expat.de' },
    })
    fireEvent.change(screen.getByLabelText(/mobile phone/i), {
      target: { value: '+491701234567' },
    })
    fireEvent.change(screen.getByLabelText(/desired loan amount/i), {
      target: { value: '420000' },
    })
    fireEvent.change(screen.getByLabelText(/property type/i), {
      target: { value: 'Apartment / Condo' },
    })
    fireEvent.change(screen.getByLabelText(/additional comments/i), {
      target: { value: 'Ready to buy next month' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith('berlin-capital', 'pre-qual', {
        responses: {
          fullName: 'Maria Weber',
          email: 'maria.weber@expat.de',
          phone: '+491701234567',
          loanAmount: 420000,
          propertyType: 'Apartment / Condo',
          notes: 'Ready to buy next month',
        },
        hp_website: undefined,
      })
    })

    // Verify success view
    await waitFor(() => {
      expect(screen.getByText('Inquiry Received')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Thank you! A senior mortgage advisor will contact you within 24 hours.',
        ),
      ).toBeInTheDocument()
    })

    // Verify "Submit another response" button resets the form
    const resetBtn = screen.getByRole('button', { name: /submit another response/i })
    expect(resetBtn).toBeInTheDocument()
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toHaveValue('')
    })
  })

  it('submits silently with honeypot if filled by a bot', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)
    const submitSpy = vi.spyOn(publicFormApi, 'submitPublicForm').mockResolvedValue({
      success: true,
      message: 'Thank you for your submission.',
    })

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    // Simulate bot filling the honeypot input
    const honeypotInput = screen.getByLabelText(/do not fill this field/i)
    fireEvent.change(honeypotInput, { target: { value: 'bot-spam-url' } })

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Spam Bot' },
    })
    fireEvent.change(screen.getByLabelText(/work or personal email/i), {
      target: { value: 'bot@spam.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith('berlin-capital', 'pre-qual', {
        responses: {
          fullName: 'Spam Bot',
          email: 'bot@spam.com',
        },
        hp_website: 'bot-spam-url',
      })
    })
  })

  it('displays generic "Form Unavailable" screen when backend returns 404 (draft, archived, missing, suspended)', async () => {
    const error404 = new AxiosError('Not Found')
    error404.response = { status: 404 } as AxiosResponse

    vi.spyOn(publicFormApi, 'getPublicForm').mockRejectedValue(error404)

    renderPublicFormPage('berlin-capital', 'draft-slug')

    await waitFor(() => {
      expect(screen.getByText('Form Unavailable')).toBeInTheDocument()
      expect(
        screen.getByText(
          /this form does not exist or is currently not accepting submissions/i,
        ),
      ).toBeInTheDocument()
    })

    // Verify it doesn't expose whether the form was a draft or archived
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/archived/i)).not.toBeInTheDocument()
  })

  it('displays clear rate-limit message when backend returns 429', async () => {
    const error429 = new AxiosError('Too Many Requests')
    error429.response = { status: 429 } as AxiosResponse

    vi.spyOn(publicFormApi, 'getPublicForm').mockRejectedValue(error429)

    renderPublicFormPage('berlin-capital', 'spammed-form')

    await waitFor(() => {
      expect(screen.getByText('Too Many Requests')).toBeInTheDocument()
      expect(
        screen.getByText(/you have accessed or submitted requests too frequently/i),
      ).toBeInTheDocument()
    })
  })

  it('displays submit loading indicator while mutation is active', async () => {
    vi.spyOn(publicFormApi, 'getPublicForm').mockResolvedValue(mockPublicForm)

    let resolveSubmission: (val: any) => void = () => {}
    vi.spyOn(publicFormApi, 'submitPublicForm').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve
        }),
    )

    renderPublicFormPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Maria Weber' },
    })
    fireEvent.change(screen.getByLabelText(/work or personal email/i), {
      target: { value: 'maria@expat.de' },
    })

    fireEvent.click(screen.getByRole('button', { name: /submit assessment/i }))

    await waitFor(() => {
      expect(screen.getByText(/submitting inquiry.../i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /submitting inquiry.../i }),
      ).toBeDisabled()
    })

    // Resolve submission
    resolveSubmission({ success: true, message: 'Done!' })

    await waitFor(() => {
      expect(screen.getByText('Inquiry Received')).toBeInTheDocument()
    })
  })

  it('generates the frontend shareable public URL with window.location.origin in FormCard and FormPreviewModal', () => {
    const clipboardSpy = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    })

    const sampleCardForm: IForm = {
      _id: 'form-99',
      brokerageId: 'brokerage-apex',
      title: 'Home Loan Inquiry',
      slug: 'nri-home-loan',
      status: 'PUBLISHED',
      fields: [],
      submitButtonText: 'Submit',
      successMessage: 'Thank you!',
      submissionCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 1. FormCard
    const { unmount: unmountCard } = render(
      <MemoryRouter>
        <FormCard
          form={sampleCardForm}
          canMutate={true}
          brokerageIdentifier="apex-finance"
          onPreview={vi.fn()}
        />
      </MemoryRouter>,
    )

    const copyBtn = screen.getByRole('button', { name: /copy link/i })
    fireEvent.click(copyBtn)

    const expectedUrl = `${window.location.origin}/forms/apex-finance/nri-home-loan`
    expect(clipboardSpy).toHaveBeenCalledWith(expectedUrl)

    unmountCard()

    // 2. FormPreviewModal
    clipboardSpy.mockClear()
    render(
      <MemoryRouter>
        <FormPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          form={sampleCardForm}
          brokerageIdentifier="apex-finance"
        />
      </MemoryRouter>,
    )

    const modalCopyBtn = screen.getByRole('button', { name: /copy public link/i })
    fireEvent.click(modalCopyBtn)

    expect(clipboardSpy).toHaveBeenCalledWith(expectedUrl)
  })
})
