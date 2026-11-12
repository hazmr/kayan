// Every email carries Arabic first, then English. All templates go through this one
// function so they look the same and nobody forgets a language.

export interface EmailSection {
  heading: string
  /** Plain-text paragraphs. They are escaped here, so callers pass raw text. */
  paragraphs: string[]
  action?: { label: string; url: string }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderSection(section: EmailSection, direction: 'rtl' | 'ltr', lang: string): string {
  const align = direction === 'rtl' ? 'right' : 'left'
  const paragraphs = section.paragraphs
    .map((text) => `<p style="margin:0 0 12px;line-height:1.7;">${escapeHtml(text)}</p>`)
    .join('')
  const action = section.action
    ? `<p style="margin:20px 0 8px;">
         <a href="${escapeHtml(section.action.url)}"
            style="display:inline-block;padding:12px 24px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
           ${escapeHtml(section.action.label)}
         </a>
       </p>
       <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;" dir="ltr">${escapeHtml(section.action.url)}</p>`
    : ''

  return `<div dir="${direction}" lang="${lang}" style="text-align:${align};padding:24px;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">${escapeHtml(section.heading)}</h2>
    ${paragraphs}
    ${action}
  </div>`
}

export function renderBilingualEmail(content: { ar: EmailSection; en: EmailSection }): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#374151;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      ${renderSection(content.ar, 'rtl', 'ar')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
      ${renderSection(content.en, 'ltr', 'en')}
    </div>
  </body>
</html>`
}

/** Subjects show both languages too, Arabic first. */
export function bilingualSubject(ar: string, en: string): string {
  return `${ar} | ${en}`
}
