import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef } from "react"

const BRAND_LINE1 = "CULTURA"
const BRAND_LINE2 = "JEWELS"

function injectBrand() {
  const heading = Array.from(document.querySelectorAll("h1, h2")).find((el) =>
    el.textContent?.toLowerCase().includes("welcome")
  )
  if (!heading) return false

  const card = heading.parentElement
  if (!card) return false

  // Hide default Medusa / legacy logo blocks without removing form nodes
  document
    .querySelectorAll('[class*="min-h-dvh"] svg[viewBox="0 0 400 400"]')
    .forEach((svg) => {
      const box = svg.closest("div")
      if (box) box.style.display = "none"
    })

  if (card.querySelector("[data-custom-login-logo='true']")) return true

  const header = document.createElement("div")
  header.setAttribute("data-custom-login-logo", "true")
  header.style.cssText =
    "margin-bottom:16px;display:flex;flex-direction:column;align-items:center;width:100%;gap:2px;"

  const line1 = document.createElement("div")
  line1.textContent = BRAND_LINE1
  line1.style.cssText =
    "font-family:Georgia,serif;font-size:28px;font-weight:700;letter-spacing:0.14em;color:#1e3a5f;"

  const line2 = document.createElement("div")
  line2.textContent = BRAND_LINE2
  line2.style.cssText =
    "font-size:10px;font-weight:600;letter-spacing:0.22em;color:#c9a227;"

  header.appendChild(line1)
  header.appendChild(line2)
  card.insertBefore(header, heading)

  heading.textContent = "Admin Sign In"
  heading.style.cssText =
    "text-align:center;width:100%;white-space:nowrap;font-size:1.25rem;line-height:1.4;margin:0;"

  const hint = heading.nextElementSibling
  if (hint instanceof HTMLElement) {
    hint.style.cssText =
      "text-align:center;width:100%;font-size:0.875rem;line-height:1.4;margin:0;"
  }

  return true
}

const LoginLogoWidget = () => {
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true

    if (injectBrand()) return

    const obs = new MutationObserver(() => {
      if (injectBrand()) obs.disconnect()
    })

    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default LoginLogoWidget
