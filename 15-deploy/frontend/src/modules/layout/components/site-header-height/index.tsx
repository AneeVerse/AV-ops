"use client"

import { useEffect } from "react"

const SiteHeaderHeight = () => {
  useEffect(() => {
    const header = document.getElementById("site-header")
    if (!header) {
      return
    }

    const syncHeight = () => {
      document.documentElement.style.setProperty(
        "--site-header-h",
        `${header.offsetHeight}px`
      )
    }

    syncHeight()

    const observer = new ResizeObserver(syncHeight)
    observer.observe(header)

    window.addEventListener("resize", syncHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", syncHeight)
    }
  }, [])

  return null
}

export default SiteHeaderHeight
