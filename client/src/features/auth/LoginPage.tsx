import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Mail, Building, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import type { LoginCredentials, UserRole } from '@/types/auth.types'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '@/components/common/LanguageToggle'

interface DemoPreset {
  role: UserRole
  label: string
  email: string
  password: string
  brokerageSlug?: string
}

// Credentials mapper: allows presentation using Indian institutional terminology
// while seamlessly fulfilling backend authentication against MongoDB seed accounts.
const CREDENTIAL_ALIASES: Record<string, { email: string; brokerageSlug?: string }> = {
  'admin@apexfinance.in': {
    email: 'klaus.mueller@berlin-mortgages.de',
    brokerageSlug: 'berlin-expat-mortgages',
  },
  'advisor@apexfinance.in': {
    email: 'elena.schmidt@berlin-mortgages.de',
    brokerageSlug: 'berlin-expat-mortgages',
  },
  'borrower@apexfinance.in': {
    email: 'alex.expat@gmail.com',
    brokerageSlug: 'berlin-expat-mortgages',
  },
  'apex-home-finance': {
    email: '',
    brokerageSlug: 'berlin-expat-mortgages',
  },
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    role: 'BROKERAGE_ADMIN',
    label: 'Brokerage Admin',
    email: 'admin@apexfinance.in',
    password: 'Password123!',
    brokerageSlug: 'apex-home-finance',
  },
  {
    role: 'ADVISOR',
    label: 'Loan Advisor',
    email: 'advisor@apexfinance.in',
    password: 'Password123!',
    brokerageSlug: 'apex-home-finance',
  },
  {
    role: 'CLIENT',
    label: 'Borrower Portal',
    email: 'borrower@apexfinance.in',
    password: 'Password123!',
    brokerageSlug: 'apex-home-finance',
  },
  {
    role: 'PLATFORM_ADMIN',
    label: 'Platform Admin',
    email: 'admin@leadflow-platform.com',
    password: 'Password123!',
  },
]

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, user } = useAuth()

  const [email, setEmail] = React.useState('admin@apexfinance.in')
  const [password, setPassword] = React.useState('Password123!')
  const [showPassword, setShowPassword] = React.useState(false)
  const [brokerageSlug, setBrokerageSlug] = React.useState('apex-home-finance')
  const [isLoading, setIsLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [activePreset, setActivePreset] = React.useState<UserRole>('BROKERAGE_ADMIN')

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname
      if (from) {
        navigate(from, { replace: true })
      } else if (user.role === 'CLIENT') {
        navigate('/portal/case', { replace: true })
      } else if (user.role === 'PLATFORM_ADMIN') {
        navigate('/admin/brokerages', { replace: true })
      } else {
        navigate('/app/pipeline', { replace: true })
      }
    }
  }, [isAuthenticated, user, navigate, location.state])

  const handleApplyPreset = (preset: DemoPreset) => {
    setActivePreset(preset.role)
    setEmail(preset.email)
    setPassword(preset.password)
    setBrokerageSlug(preset.brokerageSlug || '')
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      let resolvedEmail = email.trim()
      let resolvedSlug = brokerageSlug.trim().toLowerCase().replace(/\s+/g, '-')

      if (CREDENTIAL_ALIASES[resolvedEmail]) {
        if (CREDENTIAL_ALIASES[resolvedEmail].brokerageSlug && !resolvedSlug) {
          resolvedSlug = CREDENTIAL_ALIASES[resolvedEmail].brokerageSlug!
        }
        resolvedEmail = CREDENTIAL_ALIASES[resolvedEmail].email
      }

      if (resolvedSlug === 'apex-home-finance') {
        resolvedSlug = 'berlin-expat-mortgages'
      }

      const payload: LoginCredentials = {
        email: resolvedEmail,
        password,
      }
      if (resolvedSlug) {
        payload.brokerageSlug = resolvedSlug
      }

      const authenticatedUser = await login(payload)

      if (authenticatedUser.role === 'CLIENT') {
        navigate('/portal/case', { replace: true })
      } else if (authenticatedUser.role === 'PLATFORM_ADMIN') {
        navigate('/admin/brokerages', { replace: true })
      } else {
        navigate('/app/pipeline', { replace: true })
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } }
        setErrorMessage(
          axiosErr.response?.data?.error?.message ||
            t('common.errorDesc', 'Invalid email or password. Please verify your credentials.'),
        )
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(t('common.errorDesc', 'Unable to connect to service. Please try again.'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getPresetLabel = (role: UserRole, defaultLabel: string) => {
    switch (role) {
      case 'BROKERAGE_ADMIN':
        return t('auth.brokerageAdmin', defaultLabel)
      case 'ADVISOR':
        return t('auth.advisor', defaultLabel)
      case 'CLIENT':
        return t('auth.client', defaultLabel)
      case 'PLATFORM_ADMIN':
        return t('auth.platformAdmin', defaultLabel)
      default:
        return defaultLabel
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      {/* Language Toggle in Top Right Corner */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle variant="compact" />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">LeadFlow</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('auth.signInSubtitle', 'Mortgage Lead and Case Management Platform')}
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xs border-border bg-card">
          <CardHeader className="p-6 pb-4 space-y-1">
            <CardTitle className="text-base font-semibold text-slate-900">
              {t('auth.signInTitle', 'Sign In')}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {t('auth.enterCredentials', 'Enter your account credentials to access your workspace.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 animate-in fade-in-50 duration-150">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Input
                label={t('auth.emailLabel', 'Email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder', 'advisor@brokerage.com')}
                required
                autoComplete="email"
                startIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label={t('auth.passwordLabel', 'Password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                startIcon={<Lock className="h-4 w-4" />}
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-slate-600 hover:text-slate-800 focus:outline-none transition-colors"
                    aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <Input
                label={t('auth.brokerageIdentifier', 'Brokerage Identifier')}
                type="text"
                value={brokerageSlug}
                onChange={(e) => setBrokerageSlug(e.target.value)}
                placeholder="e.g. apex-home-finance"
                helperText={t('auth.brokerageHelper', 'Enter your brokerage ID or slug if applicable')}
                startIcon={<Building className="h-4 w-4" />}
              />

              <Button
                type="submit"
                size="md"
                className="w-full mt-2 gap-2 text-xs font-semibold h-10"
                isLoading={isLoading}
              >
                <span>{isLoading ? t('auth.signingIn', 'Signing In...') : t('auth.signInButton', 'Sign In')}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Subtle Demo Role Switcher */}
        <div className="space-y-2 pt-1 text-center">
          <p className="text-[11px] font-medium text-slate-600">
            {t('auth.quickFill', 'Quick sign-in with demo accounts:')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {DEMO_PRESETS.map((preset) => (
              <button
                key={preset.role}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                  activePreset === preset.role
                    ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {getPresetLabel(preset.role, preset.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
