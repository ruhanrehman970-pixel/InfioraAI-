import { getUser } from '@netlify/identity'
import { hasAuthCallback } from './ui'

// Email links land on the home page; the account page handles every callback type.
if (hasAuthCallback()) {
  location.replace(`/account${location.hash}`)
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in')
        observer.unobserve(entry.target)
      }
    }
  },
  { threshold: 0.12 },
)
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))

// Swap the nav buttons for signed-in visitors.
getUser().then((user) => {
  if (!user) return
  const actions = document.querySelector<HTMLElement>('[data-auth-actions]')
  if (actions) actions.innerHTML = '<a class="btn btn-primary" href="/dashboard">Go to dashboard</a>'
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/account"]').forEach((a) => (a.href = '/dashboard'))
})
