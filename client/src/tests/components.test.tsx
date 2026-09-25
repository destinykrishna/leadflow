import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

describe('UI Primitives', () => {
  describe('Button', () => {
    it('renders with children and responds to click events', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Submit Application</Button>)

      const btn = screen.getByRole('button', { name: /submit application/i })
      expect(btn).toBeInTheDocument()
      fireEvent.click(btn)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('displays loading state and disables interaction', () => {
      const handleClick = vi.fn()
      render(<Button isLoading onClick={handleClick}>Save Changes</Button>)

      const btn = screen.getByRole('button')
      expect(btn).toBeDisabled()
      fireEvent.click(btn)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Input', () => {
    it('renders label, input, and helper text cleanly', () => {
      render(
        <Input
          label="Borrower Email"
          helperText="Enter official borrower email"
          placeholder="borrower@example.de"
        />,
      )

      expect(screen.getByText('Borrower Email')).toBeInTheDocument()
      expect(screen.getByText('Enter official borrower email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('borrower@example.de')).toBeInTheDocument()
    })

    it('renders accessible error state and sets aria-invalid', () => {
      render(
        <Input
          label="Loan Amount"
          error="Loan amount must be at least €50,000"
        />,
      )

      const input = screen.getByLabelText('Loan Amount')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText('Loan amount must be at least €50,000')).toBeInTheDocument()
    })
  })

  describe('Badge', () => {
    it('renders semantic status variants', () => {
      render(<Badge variant="success">Verified</Badge>)
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })
  })

  describe('Card', () => {
    it('renders hierarchical card elements', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Case Summary</CardTitle>
            <CardDescription>German mortgage expat details</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Property in Berlin Mitte</p>
          </CardContent>
        </Card>,
      )

      expect(screen.getByText('Case Summary')).toBeInTheDocument()
      expect(screen.getByText('German mortgage expat details')).toBeInTheDocument()
      expect(screen.getByText('Property in Berlin Mitte')).toBeInTheDocument()
    })
  })

  describe('EmptyState & ErrorState', () => {
    it('renders EmptyState with title and description', () => {
      render(
        <EmptyState
          title="No Documents Uploaded"
          description="Upload required German expat documents to begin verification."
        />,
      )

      expect(screen.getByText('No Documents Uploaded')).toBeInTheDocument()
      expect(screen.getByText('Upload required German expat documents to begin verification.')).toBeInTheDocument()
    })

    it('renders ErrorState and triggers retry', () => {
      const handleRetry = vi.fn()
      render(
        <ErrorState
          title="Connection Interrupted"
          message="Failed to retrieve live mortgage pipeline."
          onRetry={handleRetry}
        />,
      )

      expect(screen.getByText('Connection Interrupted')).toBeInTheDocument()
      expect(screen.getByText('Failed to retrieve live mortgage pipeline.')).toBeInTheDocument()

      const retryBtn = screen.getByRole('button', { name: /try again/i })
      fireEvent.click(retryBtn)
      expect(handleRetry).toHaveBeenCalledTimes(1)
    })
  })
})
