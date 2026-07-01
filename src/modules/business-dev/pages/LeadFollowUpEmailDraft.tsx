/**
 * Email Draft Wrapper Page
 * Routes to step 1 or step 2 of the email drafting process
 */

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function LeadFollowUpEmailDraft() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()

  // Redirect to step 1 on mount
  useEffect(() => {
    if (contactSlug) {
      navigate(`/lead-followup/${contactSlug}/email-draft-step1`, { replace: true })
    }
  }, [contactSlug, navigate])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/lead-followup/${contactSlug}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Compose Email</h1>
      </div>

      {/* Redirect to step 1 */}
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Redirecting to email draft...</p>
      </div>
    </div>
  )
}
