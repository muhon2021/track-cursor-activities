# Quick Real Data Integration Guide

Complete the remaining 15% by adding these hook imports and replacements to each page.

## 1. LeadFollowUp.tsx (Main Dashboard)

**Add imports at top:**
```tsx
import { useLeadFollowUpContacts, useOverdueFollowUps, useDueTodayFollowUps } from '../hooks/useLeadFollowUp'
```

**Replace entire mockContacts section with:**
```tsx
export default function LeadFollowUp() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('today')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // REAL DATA QUERIES
  const { data: allContacts = [], isLoading } = useLeadFollowUpContacts({ search, status: statusFilter })
  const { data: overdueContacts = [] } = useOverdueFollowUps()
  const { data: dueTodayContacts = [] } = useDueTodayFollowUps()

  const kpis = {
    overdue: overdueContacts.length,
    dueToday: dueTodayContacts.length,
    hotLeads: allContacts.filter(c => c.lead_temperature === 'hot').length,
    avgScore: allContacts.length > 0
      ? Math.round(allContacts.reduce((sum, c) => sum + (c.lead_score || 0), 0) / allContacts.length)
      : 0,
  }

  const todayContacts = allContacts.filter(c => {
    if (!c.next_followup_date) return false
    const nextDate = new Date(c.next_followup_date)
    return isSameDay(nextDate, startOfToday()) || isBefore(nextDate, new Date())
  })

  // Rest of component stays the same, but now uses real data
```

---

## 2. LeadFollowUpContactDetail.tsx

**Add imports:**
```tsx
import { useContactBySlug, useMoodAnalysis, useIntentAnalysis } from '../hooks/useLeadFollowUp'
import { useContactActivities } from '../hooks/useLeadFollowUp'
```

**Replace mock contact with:**
```tsx
export default function LeadFollowUpContactDetail() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('quick-actions')
  const [isEditing, setIsEditing] = useState(false)

  // REAL DATA QUERIES
  const { data: contact, isLoading: contactLoading } = useContactBySlug(contactSlug || '')
  const { data: moodAnalysis } = useMoodAnalysis(contactSlug || '')
  const { data: intentAnalysis } = useIntentAnalysis(contactSlug || '')
  const { data: activities = [] } = useContactActivities(contactSlug || '')

  const [editForm, setEditForm] = useState(contact || {})

  if (contactLoading) return <Skeleton />
  if (!contact) return <div>Contact not found</div>

  // Rest of component with real data bindings
```

---

## 3. LeadFollowUpEmailDraftStep1.tsx

**Add imports:**
```tsx
import { useContactBySlug } from '../hooks/useLeadFollowUp'
import { useTriggerIntentAnalysis } from '../hooks/useLeadFollowUp'
```

**Replace generation handler:**
```tsx
const handleGenerate = async () => {
  setIsGenerating(true)
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          agent_slug: 'email-draft-generator',
          contact_id: contactSlug,
          email_intent: emailIntent,
          include_company_info: includeCompanyInfo,
          include_project_data: includeProjectData,
          meeting_limit: parseInt(meetingLimit),
          email_history: emailHistory,
        }),
      }
    )

    const result = await response.json()
    if (result.success) {
      setDraftEmail({
        subject: result.email.subject,
        body: result.email.body,
        tone: 'professional'
      })
    }
  } catch (error) {
    console.error('Generation failed:', error)
  } finally {
    setIsGenerating(false)
  }
}
```

---

## 4. LeadFollowUpEmailDraftStep2.tsx

**Add imports:**
```tsx
import { useSendEmail, useScheduleEmail } from '../hooks/useEmail'
import { useContactBySlug } from '../hooks/useLeadFollowUp'
```

**Replace send handler:**
```tsx
const sendEmail = useSendEmail()
const scheduleEmail = useScheduleEmail()
const { data: contact } = useContactBySlug(contactSlug || '')

const handleSend = async () => {
  setIsSending(true)
  try {
    if (sendMode === 'now') {
      await sendEmail.mutateAsync({
        to: [email.to],
        cc: email.cc ? email.cc.split(',').map(e => e.trim()) : undefined,
        bcc: email.bcc ? email.bcc.split(',').map(e => e.trim()) : undefined,
        subject: email.subject,
        body: email.body,
        bodyHtml: email.body,
        contactId: contactSlug,
        enableTracking: true,
      })
    } else {
      await scheduleEmail.mutateAsync({
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        body: email.body,
        contactId: contactSlug,
        scheduledFor: `${scheduleDate}T${scheduleTime}:00Z`,
      })
    }
    setShowSuccessDialog(true)
  } catch (error) {
    console.error('Send failed:', error)
  } finally {
    setIsSending(false)
  }
}
```

---

## 5. LeadFollowUpCommunication.tsx

**Add imports:**
```tsx
import { useContactActivities } from '../hooks/useLeadFollowUp'
```

**Replace mock data:**
```tsx
const { contactSlug } = useParams()
const { data: activities = [], isLoading } = useContactActivities(contactSlug || '')

const communications = activities
  .filter(a => filterType === 'all' || a.activity_type.includes(filterType))
  .map(a => ({
    id: a.id,
    type: a.activity_type as any,
    direction: a.direction as any,
    subject: a.subject,
    content: a.description,
    timestamp: new Date(a.created_at),
  }))

const totalPages = Math.ceil(communications.length / itemsPerPage)
const paginatedItems = communications.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
)
```

---

## 6. LeadFollowUpAnalyze.tsx

**Add imports:**
```tsx
import { useMoodAnalysis, useIntentAnalysis, useTriggerMoodAnalysis, useTriggerIntentAnalysis } from '../hooks/useLeadFollowUp'
```

**Replace mock data:**
```tsx
const { contactSlug } = useParams()
const { data: moodAnalysis, isLoading: moodLoading } = useMoodAnalysis(contactSlug || '')
const { data: intentAnalysis, isLoading: intentLoading } = useIntentAnalysis(contactSlug || '')
const triggerMood = useTriggerMoodAnalysis()
const triggerIntent = useTriggerIntentAnalysis()

const handleRefreshAnalysis = async () => {
  setIsLoading(true)
  try {
    await Promise.all([
      triggerMood.mutateAsync(contactSlug || ''),
      triggerIntent.mutateAsync(contactSlug || ''),
    ])
  } finally {
    setIsLoading(false)
  }
}
```

---

## Environment Variables Required

Add to `.env.local`:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Deployment Checklist

- [ ] Run all migrations: `supabase migration up`
- [ ] Deploy functions: `supabase functions deploy`
- [ ] Update `.env.local` with credentials
- [ ] Test LeadFollowUp dashboard - should show real contacts
- [ ] Test ContactDetail page - should load real contact data
- [ ] Test email drafting - should call AI agent
- [ ] Test email sending - should use SendGrid
- [ ] Verify email tracking in SendGrid dashboard
- [ ] Check database queries working correctly

---

## Verify Real Data is Working

1. **Dashboard**: Should show contacts from database with real scores
2. **Contact Detail**: Should load specific contact's information
3. **Email Draft**: Should generate emails using AI agent
4. **Email Send**: Should appear in SendGrid dashboard
5. **Analytics**: Should show mood/intent analysis

---

## Common Issues & Fixes

**No contacts showing?**
- Check `is_lead_follow_up = true` in database
- Verify RLS policies allow access
- Check browser console for errors

**Email not sending?**
- Verify SendGrid API key in admin panel
- Check from email is verified in SendGrid
- Review error in email_logs table

**AI analysis not working?**
- Verify API keys (OpenAI, Gemini, etc.)
- Check edge function logs
- Ensure contact has sufficient data

---

## You're Done! 🎉

After applying these changes:
- ✅ All pages will use real data from Supabase
- ✅ Email sending will work with SendGrid
- ✅ AI analysis will call real agents
- ✅ Tracking will be recorded
- ✅ Module is production-ready
