'use client'

import { useState, useEffect, useRef } from 'react'
import { STEP_HELP, STEP_KEYS, STEP_LABELS, type StepKey } from './_constants'
import { CaptureSettings } from './_capture-settings'
import { WizardStepBar } from './_wizard-step-bar'
import { WorkflowSidebar } from './_workflow-sidebar'
import { StepDoneButton } from './_step-done-button'
import { TodaysDraft } from './_today-draft'
import { PublishDrafts } from './_publish-drafts'
import { AddArticleManually } from './_add-article-manually'
import { AddEvent } from './_add-event'
import { ResearchImport } from './_research-import'
import { BriefingImport } from './_briefing-import'
import { PublishedIssueEditor } from './_published-issue-editor'

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  // ── Auth
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)
  // ── Workflow step refs (each wraps a workflow section for scroll-to)
  const briefingsRef = useRef<HTMLDivElement>(null) // attached to JSX in Task 4
  const researchRef  = useRef<HTMLDivElement>(null) // attached to JSX in Task 4
  const eventsRef    = useRef<HTMLDivElement>(null) // attached to JSX in Task 4
  const draftRef     = useRef<HTMLDivElement>(null)
  const publishRef   = useRef<HTMLDivElement>(null) // attached to JSX in Task 4
  const liveRef      = useRef<HTMLDivElement>(null)

  const stepRefs: Record<StepKey, { current: HTMLDivElement | null }> = {
    briefings: briefingsRef,
    research:  researchRef,
    events:    eventsRef,
    draft:     draftRef,
    publish:   publishRef,
    live:      liveRef,
  }

  // ── Workflow progress
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set())
  const [activeStep, setActiveStep] = useState<StepKey>('briefings')
  const [wizardMode, setWizardMode] = useState(false)
  const [flashingStep, setFlashingStep] = useState<StepKey | null>(null)
  const [workflowComplete, setWorkflowComplete] = useState(false)
  const [publishDraftStatus, setPublishDraftStatus] = useState({ hasDraft: false, articleCount: 0 })

  // ── Document title
  useEffect(() => {
    document.title = authed ? 'Admin — AI Today' : 'Admin sign in — AI Today'
  }, [authed])

  // ── Restore auth + mode from sessionStorage / localStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (!stored) { passwordRef.current?.focus(); return }
    // Verify the stored password before trusting it
    fetch('/api/today-draft', { headers: { 'x-admin-password': stored } })
      .then(res => {
        if (res.ok) {
          setPassword(stored)
          setAuthed(true)
          if (localStorage.getItem('adminMode') !== 'scroll') setWizardMode(true)
        } else {
          sessionStorage.removeItem('adminAuth')
          passwordRef.current?.focus()
        }
      })
      .catch(() => {
        // Network error — let the user sign in manually
        passwordRef.current?.focus()
      })
  }, [])

  // ── 'f' shortcut: toggle wizard/focus mode
  useEffect(() => {
    if (!authed) return
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (wizardMode) {
        exitWizardMode()
      } else {
        enterWizardMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, wizardMode])

  // ── Auth handlers
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const res = await fetch('/api/today-draft', { headers: { 'x-admin-password': password } })
      if (res.status === 401) {
        setAuthError('Incorrect password.')
        setAuthLoading(false)
        return
      }
      if (!res.ok) {
        setAuthError('Server error. Try again.')
        setAuthLoading(false)
        return
      }
      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
      if (localStorage.getItem('adminMode') !== 'scroll') setWizardMode(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    if (!window.confirm('Sign out?')) return
    sessionStorage.removeItem('adminAuth')
    setPassword('')
    setAuthed(false)
    setAuthError('')
  }

  function handleStepDone(key: StepKey, nextKey: StepKey | null, nextRef: React.RefObject<HTMLDivElement | null> | null) {
    setCompletedSteps(prev => new Set([...prev, key]))
    setFlashingStep(key)
    setTimeout(() => setFlashingStep(null), 600)
    if (!nextKey) setWorkflowComplete(true)
    if (nextKey) setActiveStep(nextKey)
    if (nextRef?.current) nextRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleSidebarClick(key: StepKey, ref: React.RefObject<HTMLDivElement | null>) { // wired to WorkflowSidebar in Task 4
    setActiveStep(key)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function enterWizardMode() {
    localStorage.setItem('adminMode', 'focus')
    const firstIncomplete = STEP_KEYS.find(k => !completedSteps.has(k)) ?? STEP_KEYS[0]
    setActiveStep(firstIncomplete)
    setWorkflowComplete(false)
    setWizardMode(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  function exitWizardMode() {
    localStorage.setItem('adminMode', 'scroll')
    setWizardMode(false)
    setTimeout(() => stepRefs[activeStep]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // ── Render: sign-in ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="admin-workspace grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-md">
        <h1 className="text-[48px] sm:text-[56px] font-black leading-[0.95] tracking-tight mb-3 font-[family-name:var(--font-display)]">
          Admin sign in
        </h1>
        <p className="mb-8 text-[16px] leading-[1.55] text-ws-muted">
          Import sources, assemble the issue, and publish the daily brief from one focused console.
        </p>
        <div className="glass-panel rounded-[0.8rem] p-6">
          <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[13px] font-black uppercase tracking-wide">
                Password
              </label>
              <input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={authLoading}
                required
                className="border border-ws-border rounded-sm px-3 py-3 text-[17px] font-mono w-full focus-visible:outline-none focus-visible:border-ws-accent transition-colors disabled:bg-ws-page"
              />
              {authError && (
                <p className="text-[14px] font-bold text-ws-accent" role="alert">{authError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={authLoading || !password}
              className="bg-ws-accent text-white rounded-sm px-5 py-2.5 font-semibold text-[15px] self-start hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        </div>
      </div>
    )
  }

  // ── Render: main admin ────────────────────────────────────────────────────────

  // ── Wizard mode render ───────────────────────────────────────────────────────
  if (wizardMode) {
    const wizActiveIndex = STEP_KEYS.indexOf(activeStep)
    const wizNextStep    = wizActiveIndex < STEP_KEYS.length - 1 ? STEP_KEYS[wizActiveIndex + 1] : null
    const wizPrevStep    = wizActiveIndex > 0 ? STEP_KEYS[wizActiveIndex - 1] : null
    const publishStillPending =
      publishDraftStatus.hasDraft &&
      publishDraftStatus.articleCount > 0
    const activeStepBlockedByPublish =
      (activeStep === 'publish' || activeStep === 'live') &&
      publishStillPending

    return (
      <div className="admin-workspace w-full flex flex-col">
        {/* Step bar — sticky, full bleed */}
        <div className="sticky top-0 z-40">
          <WizardStepBar
            steps={STEP_KEYS}
            labels={STEP_LABELS}
            activeStep={activeStep}
            completedSteps={completedSteps}
            flashingStep={flashingStep}
            onStepClick={setActiveStep}
          />
        </div>

        {/* Wizard body */}
        <div className="flex-1 py-8 max-w-4xl w-full mx-auto">

          {/* Daily header */}
          <div className="glass-panel rounded-[0.8rem] flex items-start justify-between gap-4 mb-8 p-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ws-black/40 mb-1">Today</p>
              <p className="text-[24px] sm:text-[30px] font-semibold tracking-tight leading-none">
                {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1 shrink-0">
              <button
                type="button"
                onClick={exitWizardMode}
                className="text-[12px] font-black uppercase tracking-[0.1em] text-ws-black/40 hover:text-ws-black transition-colors"
              >
                View all sections
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[12px] font-black uppercase tracking-[0.1em] text-ws-black/40 hover:text-ws-black transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Step title */}
          <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight leading-[0.95] mb-6 font-[family-name:var(--font-display)]">
            {STEP_LABELS[activeStep]}
          </h2>
          <p className="text-[14px] leading-relaxed text-ws-black/65 max-w-2xl -mt-3 mb-6">
            <span className="font-black uppercase tracking-[0.12em] text-[11px] text-ws-black/45">
              Step {wizActiveIndex + 1} of {STEP_KEYS.length}
            </span>
            <br />
            {STEP_HELP[activeStep]}
          </p>

          {/* Sections — all mounted, only active one visible */}
          <div className={activeStep === 'briefings' ? '' : 'hidden'}>
            <BriefingImport password={password} />
          </div>
          <div className={activeStep === 'research' ? '' : 'hidden'}>
            <ResearchImport password={password} />
          </div>
          <div className={activeStep === 'events' ? '' : 'hidden'}>
            <AddEvent password={password} />
          </div>
          <div className={activeStep === 'draft' ? '' : 'hidden'}>
            <TodaysDraft password={password} showPublishAction={false} />
            <AddArticleManually password={password} />
          </div>
          <div className={activeStep === 'publish' ? '' : 'hidden'}>
            <div className="mb-5 border-l-[4px] border-ws-accent bg-ws-white px-4 py-3">
              <p className="text-[13px] font-bold text-ws-black">
                Daily order: publish today&apos;s issue here first, then use Edit Live Issue only for corrections or late additions.
              </p>
            </div>
            <TodaysDraft password={password} onDraftStatusChange={setPublishDraftStatus} />
            <PublishDrafts password={password} />
          </div>
          <div className={activeStep === 'live' ? '' : 'hidden'}>
            {workflowComplete && (
              <div className="mb-5 border-[3px] border-ws-black bg-ws-accent-light/40 px-5 py-4 shadow-[4px_4px_0_0_var(--color-ws-black)]">
                <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Workflow complete</p>
                <p className="text-[14px] text-ws-black/75 mt-1">The daily issue is published, and live edits are available here whenever you need them.</p>
              </div>
            )}
            <PublishedIssueEditor password={password} />
          </div>
          {/* Wizard nav footer */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-ws-border">
            {/* Back */}
            {wizPrevStep ? (
              <button
                type="button"
                onClick={() => setActiveStep(wizPrevStep)}
                className="text-[14px] font-medium text-ws-muted hover:text-ws-black transition-colors"
              >
                ← Back
              </button>
            ) : <div />}

            {/* Continue / Complete */}
            {wizNextStep ? (
              activeStepBlockedByPublish ? (
                <button
                  type="button"
                  disabled
                  className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold opacity-50 cursor-not-allowed"
                  title="Publish today's issue before moving to live edits"
                >
                  Publish today&apos;s issue first
                </button>
              ) : (
              <button
                type="button"
                onClick={() => handleStepDone(activeStep, wizNextStep, null)}
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150"
              >
                Continue to {STEP_LABELS[wizNextStep]} →
              </button>
              )
            ) : publishStillPending ? (
              <button
                type="button"
                disabled
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold opacity-50 cursor-not-allowed"
                title="Publish today's issue before completing the workflow"
              >
                Publish today&apos;s issue first
              </button>
            ) : workflowComplete ? (
              <button
                type="button"
                onClick={exitWizardMode}
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150"
              >
                View all sections
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStepDone(activeStep, null, null)}
                className="bg-ws-accent text-white px-8 py-3 rounded-sm text-[15px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all duration-150"
              >
                Complete workflow ✓
              </button>
            )}
          </div>

        </div>
      </div>
    )
  }

  const sidebarSteps = STEP_KEYS.map(key => ({
    key,
    label: STEP_LABELS[key],
    ref:   stepRefs[key],
  }))
  const publishStillPending =
    publishDraftStatus.hasDraft &&
    publishDraftStatus.articleCount > 0

  return (
    <div className="admin-workspace flex items-start">
      {/* Sticky workflow sidebar */}
      <WorkflowSidebar
        steps={sidebarSteps}
        completedSteps={completedSteps}
        activeStep={activeStep}
        onStepClick={handleSidebarClick}
      />

      {/* Main content column */}
      <div className="flex-1 min-w-0 flex flex-col gap-8 px-6 py-0">

        {/* Header */}
        <div className="glass-panel rounded-[0.8rem] flex items-start justify-between gap-4 flex-wrap p-6">
          <div>
            <p className="editorial-label mb-4">Publisher console</p>
            <h1 className="text-[52px] sm:text-[72px] font-black leading-[0.9] tracking-tight mb-3 font-[family-name:var(--font-display)]">
              Daily desk
            </h1>
            <p className="max-w-2xl text-[16px] leading-[1.55] text-ws-muted">
              Import briefings, review research and events, assemble the issue, publish it, then handle live edits from one clean workflow.
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button
              type="button"
              onClick={enterWizardMode}
              className="border-[2px] border-ws-black px-3 py-2 text-[12px] font-black uppercase tracking-[0.1em] hover:bg-ws-page hover:border-ws-accent transition-colors"
            >
              Daily workflow →
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[13px] font-black uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── Step 1: Briefings ─────────────────────────────────────────── */}
        <div ref={briefingsRef}>
          <BriefingImport password={password} />
          <StepDoneButton
            currentKey="briefings"
            nextKey="research"
            nextLabel={STEP_LABELS.research}
            nextRef={researchRef}
            completedSteps={completedSteps}
            onDone={handleStepDone}
          />
        </div>

        {/* ── Step 2: Research Papers ───────────────────────────────────── */}
        <div ref={researchRef}>
          <ResearchImport password={password} />
          <StepDoneButton
            currentKey="research"
            nextKey="events"
            nextLabel={STEP_LABELS.events}
            nextRef={eventsRef}
            completedSteps={completedSteps}
            onDone={handleStepDone}
          />
        </div>

        {/* ── Step 3: Add Events ────────────────────────────────────────── */}
        <div ref={eventsRef}>
          <AddEvent password={password} />
          <StepDoneButton
            currentKey="events"
            nextKey="draft"
            nextLabel={STEP_LABELS.draft}
            nextRef={draftRef}
            completedSteps={completedSteps}
            onDone={handleStepDone}
          />
        </div>

        {/* ── Step 4: Review Draft + manual article add ─────────────────── */}
        <div ref={draftRef}>
          <TodaysDraft password={password} showPublishAction={false} />
          <AddArticleManually password={password} />
          <StepDoneButton
            currentKey="draft"
            nextKey="publish"
            nextLabel={STEP_LABELS.publish}
            nextRef={publishRef}
            completedSteps={completedSteps}
            onDone={handleStepDone}
          />
        </div>

        {/* ── Step 5: Publish ───────────────────────────────────────────── */}
        <div ref={publishRef}>
          <div className="border-l-[4px] border-ws-accent bg-ws-white px-4 py-3 mb-5">
            <p className="text-[13px] font-bold text-ws-black">
              Daily order: publish today&apos;s issue here first, then use Edit Live Issue only for corrections or late additions.
            </p>
          </div>
          <TodaysDraft password={password} onDraftStatusChange={setPublishDraftStatus} />
          <PublishDrafts password={password} />
          <StepDoneButton
            currentKey="publish"
            nextKey="live"
            nextLabel={STEP_LABELS.live}
            nextRef={liveRef}
            completedSteps={completedSteps}
            onDone={handleStepDone}
            disabled={publishStillPending}
            disabledLabel="Publish today first"
            title="Publish today's issue before moving to live edits"
          />
        </div>

        {/* Step 6: Edit an already-published issue */}
        <div ref={liveRef}>
          <PublishedIssueEditor password={password} />
          <StepDoneButton
            currentKey="live"
            nextKey={null}
            nextLabel={null}
            nextRef={null}
            completedSteps={completedSteps}
            onDone={handleStepDone}
            disabled={publishStillPending}
            disabledLabel="Publish today first"
            title="Publish today's issue before marking the workflow complete"
          />
        </div>

        {/* Capture settings — not a workflow step */}
        <div id="capture-settings">
          <CaptureSettings />
        </div>

      </div>
    </div>
  )
}
