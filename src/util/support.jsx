export function openSupport() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL

  if (supportEmail) {
    window.location.href = `mailto:${supportEmail}`
  } else {
    window.location.assign("/faq")
  }
}