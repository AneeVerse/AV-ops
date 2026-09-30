//
// Copyright © 2026 AneeVerse
//

import { invoicesDocumentHtml, type InvoiceView } from './invoiceHtml'

export function printInvoices (views: InvoiceView[], title: string): void {
  if (views.length === 0) return
  const html = invoicesDocumentHtml(views, title)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '0'
  iframe.style.top = '0'
  iframe.style.width = '210mm'
  iframe.style.height = '297mm'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-1'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (doc == null) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()

  let removed = false
  const cleanup = (): void => {
    if (removed) return
    removed = true
    iframe.remove()
  }

  const run = (): void => {
    const win = iframe.contentWindow
    if (win == null) {
      cleanup()
      return
    }
    win.addEventListener('afterprint', cleanup)
    window.setTimeout(cleanup, 120000)
    win.focus()
    win.print()
  }

  if (iframe.contentWindow?.document.readyState === 'complete') {
    window.setTimeout(run, 250)
  } else {
    iframe.onload = () => {
      window.setTimeout(run, 250)
    }
  }
}
