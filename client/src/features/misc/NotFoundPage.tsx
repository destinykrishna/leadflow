import { useNavigate } from 'react-router-dom'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center bg-slate-50">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-600 mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Page Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        The requested resource does not exist or you lack sufficient tenant authorization to view it.
      </p>
      <div className="mt-6">
        <Button variant="primary" size="md" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Workspace</span>
        </Button>
      </div>
    </div>
  )
}
