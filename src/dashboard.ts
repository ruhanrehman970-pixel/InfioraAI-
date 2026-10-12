import { getUser, logout } from '@netlify/identity'

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

async function init() {
  const user = await getUser()
  if (!user) return location.replace('/account?mode=login')

  const meta = user.userMetadata ?? {}
  const name = user.name || user.email?.split('@')[0] || 'learner'
  const accountType = meta.account_type === 'teacher' ? 'Teacher' : 'Student'
  const language = typeof meta.preferred_language === 'string' ? languageName(meta.preferred_language) : 'English'
  const plan = user.roles?.includes('pro') ? 'Pro' : 'Free'

  document.querySelector('[data-first-name]')!.textContent = name.split(' ')[0]
  document.querySelector('[data-role-label]')!.textContent = `${accountType} dashboard`
  if (accountType === 'Teacher') document.querySelector<HTMLElement>('[data-teacher-only]')!.hidden = false

  const dl = document.querySelector('[data-profile]')!
  dl.replaceChildren()
  for (const [label, value] of [
    ['Name', user.name || '—'],
    ['Email', user.email || '—'],
    ['Account type', accountType],
    ['Language', language],
    ['Plan', plan],
  ]) {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = label
    dd.textContent = value
    dl.append(dt, dd)
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-logout]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    btn.disabled = true
    try {
      await logout()
    } finally {
      location.assign('/')
    }
  }),
)

init()
