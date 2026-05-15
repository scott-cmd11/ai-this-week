#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const REQUIRED_WORKFLOWS = [
  {
    path: '.github/workflows/evening-google-alerts-candidates.yml',
    name: 'Evening Google Alerts Candidate Import',
    purpose: '7:15 PM Winnipeg Google Alerts/RSS candidate intake',
  },
]

const REQUIRED_CRONS = [
  { path: '/api/cron/daily-assemble', schedule: '0 23 * * *', label: 'Daily assemble' },
  { path: '/api/cron/autopublish', schedule: '30 1 * * *', label: 'Nightly autopublish' },
]

function parseArgs(argv) {
  const args = {
    apiBase: process.env.AI_TODAY_API_BASE || 'https://aitoday.vercel.app',
    date: null,
    repo: null,
    skipGithub: false,
    json: false,
    strict: false,
    warnOnly: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--api-base' && next) {
      args.apiBase = next
      i += 1
    } else if (arg === '--date' && next) {
      args.date = next
      i += 1
    } else if (arg === '--repo' && next) {
      args.repo = next
      i += 1
    } else if (arg === '--skip-github') {
      args.skipGithub = true
    } else if (arg === '--json') {
      args.json = true
    } else if (arg === '--strict') {
      args.strict = true
    } else if (arg === '--warn-only') {
      args.warnOnly = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  args.apiBase = args.apiBase.replace(/\/$/, '')
  return args
}

function printHelp() {
  console.log(`AI Today publishing preflight

Usage:
  npm run preflight:publishing -- [--api-base https://aitoday.vercel.app] [--date YYYY-MM-DD] [--strict]

Options:
  --api-base       Admin API base URL. Defaults to AI_TODAY_API_BASE or production.
  --date           Issue date to check. Defaults to the API's current Winnipeg issue date.
  --repo           GitHub repo, for example scott-cmd11/ai-this-week.
  --skip-github    Skip read-only GitHub default-branch workflow checks.
  --json           Print JSON output.
  --strict         Exit non-zero on warnings as well as failures.
  --warn-only      Never exit non-zero; useful while wiring CI/reporting.
`)
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equals = trimmed.indexOf('=')
    if (equals <= 0) continue
    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (result.error) {
    return { ok: false, stdout: '', stderr: result.error.message, status: null }
  }
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
}

function readLocalWorkflowPaths() {
  const workflowDir = path.join(process.cwd(), '.github', 'workflows')
  if (!existsSync(workflowDir)) return []
  return readdirSync(workflowDir)
    .filter(file => /\.ya?ml$/i.test(file))
    .map(file => `.github/workflows/${file}`)
}

function workflowNameMatches(activeName, workflow) {
  const normalizedActive = activeName.trim().toLowerCase()
  const normalizedName = workflow.name.trim().toLowerCase()
  const fileName = workflow.path.split('/').pop()?.replace(/\.ya?ml$/i, '').toLowerCase() || ''
  return normalizedActive === normalizedName || normalizedActive.includes(normalizedName) || normalizedActive.includes(fileName)
}

function checkWorkflows({ localWorkflowPaths, defaultBranchWorkflowPaths, activeWorkflowNames, defaultBranchName }) {
  const localPaths = new Set(localWorkflowPaths.map(normalizePath))
  const defaultPaths = Array.isArray(defaultBranchWorkflowPaths)
    ? new Set(defaultBranchWorkflowPaths.map(normalizePath))
    : null
  const activeNames = Array.isArray(activeWorkflowNames) ? activeWorkflowNames : null

  const checks = REQUIRED_WORKFLOWS.map(workflow => {
    const requiredPath = normalizePath(workflow.path)
    const presentLocally = localPaths.has(requiredPath)
    const presentOnDefaultBranch = defaultPaths ? defaultPaths.has(requiredPath) : null
    const activeOnDefaultBranch = activeNames ? activeNames.some(name => workflowNameMatches(name, workflow)) : null

    if (!presentLocally) {
      return {
        ...workflow,
        status: 'fail',
        detail: `${workflow.path} is missing locally.`,
        nextAction: 'Restore the required workflow file before relying on scheduled source intake.',
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
      }
    }
    if (presentOnDefaultBranch === false) {
      return {
        ...workflow,
        status: 'fail',
        detail: `${workflow.path} exists locally but is missing from ${defaultBranchName || 'the default branch'}.`,
        nextAction: 'Merge the workflow to the default branch so GitHub can schedule it.',
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
      }
    }
    if (activeOnDefaultBranch === false) {
      return {
        ...workflow,
        status: 'fail',
        detail: `${workflow.name} is present but not active in GitHub Actions.`,
        nextAction: 'Enable the workflow or verify it exists on the default branch with schedule triggers.',
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
      }
    }
    if (presentOnDefaultBranch === null || activeOnDefaultBranch === null) {
      return {
        ...workflow,
        status: 'unknown',
        detail: `${workflow.name} could not be verified against GitHub/default-branch state.`,
        nextAction: 'Run again with GitHub CLI auth or inspect the default branch manually.',
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
      }
    }
    return {
      ...workflow,
      status: 'pass',
      detail: `${workflow.name} exists locally, exists on ${defaultBranchName || 'the default branch'}, and is active.`,
      nextAction: 'No workflow action needed.',
      presentLocally,
      presentOnDefaultBranch,
      activeOnDefaultBranch,
    }
  })

  return {
    ok: checks.every(check => check.status === 'pass'),
    defaultBranchName,
    checks,
  }
}

function inspectGitHub(repoArg) {
  let repo = repoArg
  let defaultBranchName = null
  const warnings = []

  if (!repo) {
    const view = run('gh', ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'])
    if (!view.ok) {
      return {
        ok: false,
        repo: null,
        defaultBranchName: null,
        defaultBranchWorkflowPaths: null,
        activeWorkflowNames: null,
        warnings: [`GitHub repo lookup failed: ${(view.stderr || view.stdout).trim() || 'unknown error'}`],
      }
    }
    try {
      const parsed = JSON.parse(view.stdout)
      repo = parsed.nameWithOwner
      defaultBranchName = parsed.defaultBranchRef?.name || null
    } catch (err) {
      return {
        ok: false,
        repo: null,
        defaultBranchName: null,
        defaultBranchWorkflowPaths: null,
        activeWorkflowNames: null,
        warnings: [`GitHub repo lookup returned invalid JSON: ${err instanceof Error ? err.message : 'unknown error'}`],
      }
    }
  }

  if (!defaultBranchName && repo) {
    const view = run('gh', ['repo', 'view', repo, '--json', 'defaultBranchRef'])
    if (view.ok) {
      try {
        defaultBranchName = JSON.parse(view.stdout).defaultBranchRef?.name || null
      } catch {
        warnings.push('Could not parse default branch from GitHub CLI output.')
      }
    } else {
      warnings.push(`Default branch lookup failed: ${(view.stderr || view.stdout).trim() || 'unknown error'}`)
    }
  }

  let defaultBranchWorkflowPaths = null
  if (repo && defaultBranchName) {
    const contents = run('gh', ['api', `repos/${repo}/contents/.github/workflows?ref=${defaultBranchName}`])
    if (contents.ok) {
      try {
        const parsed = JSON.parse(contents.stdout)
        defaultBranchWorkflowPaths = Array.isArray(parsed) ? parsed.map(item => item.path).filter(Boolean) : []
      } catch {
        warnings.push('Could not parse default-branch workflow file list.')
      }
    } else {
      warnings.push(`Default-branch workflow file lookup failed: ${(contents.stderr || contents.stdout).trim() || 'unknown error'}`)
    }
  }

  let activeWorkflowNames = null
  if (repo) {
    const jsonList = run('gh', ['workflow', 'list', '--repo', repo, '--all', '--json', 'name,state,path'])
    if (jsonList.ok) {
      try {
        const parsed = JSON.parse(jsonList.stdout)
        activeWorkflowNames = parsed
          .filter(workflow => String(workflow.state || '').toLowerCase() === 'active')
          .map(workflow => workflow.name)
          .filter(Boolean)
      } catch {
        warnings.push('Could not parse GitHub workflow list JSON.')
      }
    } else {
      const textList = run('gh', ['workflow', 'list', '--repo', repo, '--all'])
      if (textList.ok) {
        activeWorkflowNames = textList.stdout.split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const marker = line.search(/\sactive\s/i)
            return marker > 0 ? line.slice(0, marker).trim() : null
          })
          .filter(Boolean)
      } else {
        warnings.push(`GitHub workflow state lookup failed: ${(jsonList.stderr || jsonList.stdout || textList.stderr || textList.stdout).trim() || 'unknown error'}`)
      }
    }
  }

  return {
    ok: true,
    repo,
    defaultBranchName,
    defaultBranchWorkflowPaths,
    activeWorkflowNames,
    warnings,
  }
}

function checkVercelCrons() {
  const configPath = path.join(process.cwd(), 'vercel.json')
  if (!existsSync(configPath)) {
    return {
      ok: false,
      checks: REQUIRED_CRONS.map(cron => ({
        ...cron,
        status: 'fail',
        detail: 'vercel.json is missing.',
        nextAction: 'Restore vercel.json before relying on Vercel cron publishing.',
      })),
    }
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (err) {
    return {
      ok: false,
      checks: REQUIRED_CRONS.map(cron => ({
        ...cron,
        status: 'fail',
        detail: `vercel.json could not be parsed: ${err instanceof Error ? err.message : 'unknown error'}`,
        nextAction: 'Fix vercel.json before deploying.',
      })),
    }
  }

  const crons = Array.isArray(parsed.crons) ? parsed.crons : []
  const checks = REQUIRED_CRONS.map(required => {
    const match = crons.find(cron => cron.path === required.path)
    if (!match) {
      return {
        ...required,
        status: 'fail',
        detail: `${required.label} cron is missing from vercel.json.`,
        nextAction: 'Restore the required Vercel cron entry before deploy.',
      }
    }
    if (match.schedule !== required.schedule) {
      return {
        ...required,
        status: 'warn',
        detail: `${required.label} cron exists with schedule ${match.schedule}; expected ${required.schedule}.`,
        nextAction: 'Confirm the schedule still matches the 8 PM Winnipeg publishing routine.',
      }
    }
    return {
      ...required,
      status: 'pass',
      detail: `${required.label} cron is configured at ${required.schedule}.`,
      nextAction: 'No cron action needed.',
    }
  })

  return {
    ok: checks.every(check => check.status === 'pass'),
    checks,
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  let body = null
  const text = await response.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 500) }
    }
  }
  return { ok: response.ok, status: response.status, body }
}

async function inspectAdminApi(args) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return {
      ok: false,
      status: null,
      candidateApi: null,
      dryRunPublish: null,
      dryRunAutopublish: null,
      warnings: ['ADMIN_PASSWORD is not available locally; admin API checks were skipped.'],
    }
  }

  const query = args.date ? `?date=${encodeURIComponent(args.date)}` : ''
  const headers = { 'x-admin-password': adminPassword }
  const status = await fetchJson(`${args.apiBase}/api/admin/today-status${query}`, { headers })
  const candidateApi = await fetchJson(`${args.apiBase}/api/article-candidates?status=new,approved,shortlisted&limit=5`, { headers })
  const dryRunAssemble = await fetchJson(`${args.apiBase}/api/cron/daily-assemble`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adminPassword,
      dryRun: true,
      ...(args.date ? { date: args.date } : {}),
    }),
  })
  const dryRunPublish = await fetchJson(`${args.apiBase}/api/cron/daily-publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adminPassword,
      dryRun: true,
      ...(args.date ? { date: args.date } : {}),
    }),
  })
  const dryRunAutopublish = await fetchJson(`${args.apiBase}/api/cron/autopublish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      adminPassword,
      dryRun: true,
      ...(args.date ? { date: args.date } : {}),
    }),
  })

  return {
    ok: status.ok && candidateApi.ok && dryRunAssemble.ok && dryRunPublish.ok && dryRunAutopublish.ok,
    status,
    candidateApi,
    dryRunAssemble,
    dryRunPublish,
    dryRunAutopublish,
    warnings: [],
  }
}

function summarizeAdminChecks(admin) {
  const checks = []
  if (!admin.status) {
    checks.push({
      label: 'Admin status',
      status: 'unknown',
      detail: 'Admin status API was not checked.',
      nextAction: 'Set ADMIN_PASSWORD locally and rerun preflight.',
    })
    return checks
  }

  checks.push({
    label: 'Admin status',
    status: admin.status.ok ? 'pass' : 'fail',
    detail: admin.status.ok
      ? `today-status returned ${admin.status.status}.`
      : `today-status returned ${admin.status.status}.`,
    nextAction: admin.status.ok ? 'No admin status action needed.' : 'Fix admin status before publishing.',
  })

  const preflight = admin.status.body?.preflight
  if (preflight) {
    checks.push({
      label: 'Publishing preflight',
      status: preflight.state === 'ready' ? 'pass' : preflight.state === 'blocked' ? 'fail' : 'warn',
      detail: `${preflight.headline}: ${preflight.nextAction}`,
      nextAction: preflight.nextAction,
    })
  } else if (admin.status.ok) {
    checks.push({
      label: 'Publishing preflight',
      status: 'warn',
      detail: 'today-status did not include a preflight payload.',
      nextAction: 'Deploy the prevention guardrail branch before using API preflight checks.',
    })
  }

  checks.push({
    label: 'Candidate API',
    status: admin.candidateApi?.ok ? 'pass' : 'fail',
    detail: admin.candidateApi?.ok
      ? `article-candidates returned ${admin.candidateApi.status}.`
      : `article-candidates returned ${admin.candidateApi?.status ?? 'not checked'}.`,
    nextAction: admin.candidateApi?.ok ? 'No candidate API action needed.' : 'Fix candidate API access before publishing.',
  })

  const draftExists = admin.status?.body?.draft?.exists === true
  const published = admin.status?.body?.draft?.published === true
  const assembleImportable = Number(admin.dryRunAssemble?.body?.imported ?? 0)
  checks.push({
    label: 'Dry-run daily assemble',
    status: admin.dryRunAssemble?.ok
      ? (!draftExists && !published && assembleImportable > 0 ? 'fail' : assembleImportable > 0 ? 'pass' : 'warn')
      : 'fail',
    detail: admin.dryRunAssemble?.ok
      ? `dry-run assemble returned ${admin.dryRunAssemble.status}: ${assembleImportable} importable article${assembleImportable === 1 ? '' : 's'} from ${admin.dryRunAssemble.body?.parsed ?? 0} parsed source item${admin.dryRunAssemble.body?.parsed === 1 ? '' : 's'}.`
      : `dry-run assemble returned ${admin.dryRunAssemble?.status ?? 'not checked'}.`,
    nextAction: admin.dryRunAssemble?.ok
      ? (!draftExists && !published && assembleImportable > 0
          ? 'Daily assemble has material but no draft exists. Check Vercel cron execution or run assemble intentionally before publish.'
          : assembleImportable > 0
            ? 'Assembly source material is available.'
            : 'No assemble-ready source material was found; check briefing sources before publish.')
      : 'Fix or deploy the daily assemble dry-run route before relying on cron publishing.',
  })

  checks.push({
    label: 'Dry-run cron publish',
    status: admin.dryRunPublish?.ok ? 'pass' : 'fail',
    detail: admin.dryRunPublish?.ok
      ? `dry-run publish returned ${admin.dryRunPublish.status}: ${admin.dryRunPublish.body?.reason || admin.dryRunPublish.body?.published || 'checked'}.`
      : `dry-run publish returned ${admin.dryRunPublish?.status ?? 'not checked'}.`,
    nextAction: admin.dryRunPublish?.ok ? 'Use the dry-run response as the deploy publishing-health check.' : 'Deploy the dry-run route or fix publish-readiness errors before publishing.',
  })

  checks.push({
    label: 'Dry-run autopublish',
    status: admin.dryRunAutopublish?.ok ? 'pass' : 'fail',
    detail: admin.dryRunAutopublish?.ok
      ? `dry-run autopublish returned ${admin.dryRunAutopublish.status}: ${admin.dryRunAutopublish.body?.reason || (admin.dryRunAutopublish.body?.publishable ? 'publishable' : 'checked')}.`
      : `dry-run autopublish returned ${admin.dryRunAutopublish?.status ?? 'not checked'}.`,
    nextAction: admin.dryRunAutopublish?.ok
      ? 'Use the dry-run autopublish response as the main vacation-mode deploy health check.'
      : 'Deploy or fix the autopublish controller before relying on unattended nightly publishing.',
  })

  return checks
}

function statusWeight(status) {
  if (status === 'fail') return 3
  if (status === 'warn' || status === 'unknown') return 2
  return 1
}

function printText(result) {
  console.log('AI Today publishing preflight')
  console.log(`API base: ${result.apiBase}`)
  if (result.issueDate) console.log(`Issue date: ${result.issueDate}`)
  if (result.github.repo) console.log(`GitHub: ${result.github.repo} (${result.github.defaultBranchName || 'default branch unknown'})`)
  console.log('')

  for (const group of result.groups) {
    console.log(group.label)
    for (const check of group.checks) {
      const prefix = check.status.toUpperCase().padEnd(7, ' ')
      const label = check.label || check.name || check.path || 'Check'
      console.log(`  ${prefix} ${label} - ${check.detail}`)
      if (check.status !== 'pass') console.log(`          Next: ${check.nextAction}`)
    }
    console.log('')
  }

  if (result.warnings.length > 0) {
    console.log('Warnings')
    for (const warning of result.warnings) console.log(`  WARN    ${warning}`)
    console.log('')
  }

  console.log(result.ok ? 'Preflight result: OK' : 'Preflight result: ATTENTION NEEDED')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnvFile(path.join(process.cwd(), '.env.local'))
  loadEnvFile(path.join(process.cwd(), '.env'))

  const localWorkflowPaths = readLocalWorkflowPaths()
  const github = args.skipGithub
    ? {
        ok: false,
        repo: args.repo,
        defaultBranchName: null,
        defaultBranchWorkflowPaths: null,
        activeWorkflowNames: null,
        warnings: ['GitHub workflow checks were skipped by flag.'],
      }
    : inspectGitHub(args.repo)

  const workflowGuard = checkWorkflows({
    localWorkflowPaths,
    defaultBranchWorkflowPaths: github.defaultBranchWorkflowPaths,
    activeWorkflowNames: github.activeWorkflowNames,
    defaultBranchName: github.defaultBranchName,
  })
  const crons = checkVercelCrons()
  const admin = await inspectAdminApi(args)
  const adminChecks = summarizeAdminChecks(admin)

  const groups = [
    { label: 'Admin and publishing health', checks: adminChecks },
    { label: 'Default-branch scheduled workflows', checks: workflowGuard.checks },
    { label: 'Vercel cron shape', checks: crons.checks },
  ]
  const allChecks = groups.flatMap(group => group.checks)
  const warnings = [...github.warnings, ...admin.warnings]
  const hasFailures = allChecks.some(check => check.status === 'fail')
  const hasWarnings = allChecks.some(check => statusWeight(check.status) === 2) || warnings.length > 0
  const ok = !hasFailures && (!args.strict || !hasWarnings)
  const issueDate = admin.status?.body?.issueDate || args.date || null

  const result = {
    ok,
    apiBase: args.apiBase,
    issueDate,
    github,
    groups,
    adminStatus: admin.status?.body || null,
    dryRunAssemble: admin.dryRunAssemble?.body || null,
    dryRunPublish: admin.dryRunPublish?.body || null,
    dryRunAutopublish: admin.dryRunAutopublish?.body || null,
    warnings,
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printText(result)
  }

  if (!args.warnOnly && !ok) process.exitCode = 1
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
