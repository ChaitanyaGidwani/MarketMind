import { useEffect, useMemo, useState } from 'react'

const ORCHESTRATOR_URL = 'http://localhost:8001'

const TABS = [
  { key: 'content', label: 'Content Pack' },
  { key: 'emails', label: 'Email Sequence' },
  { key: 'seo', label: 'SEO Brief' },
  { key: 'ads', label: 'Ads Copy' },
]

function CopyButton({ text, label = '📋 Copy' }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1300)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button onClick={onCopy} className="rounded-lg border border-border bg-canvas px-3 py-1.5 text-sm text-text-primary hover:bg-border">
      {copied ? '✅ Copied' : label}
    </button>
  )
}

function difficultyMeta(value) {
  const score = Number(value || 0)
  if (score <= 35) return { label: 'easy', cls: 'bg-success/20 text-success' }
  if (score <= 65) return { label: 'medium', cls: 'bg-amber-500/20 text-amber-400' }
  return { label: 'hard', cls: 'bg-red-500/20 text-red-300' }
}

function priorityMeta(row) {
  const vol = Number(row?.volume || row?.est_volume || 0)
  const diff = Number(row?.difficulty || 0)
  if (vol >= 2500 && diff <= 45) return { label: 'High', dot: 'bg-success' }
  if (vol >= 1000 && diff <= 70) return { label: 'Medium', dot: 'bg-amber-400' }
  return { label: 'Low', dot: 'bg-red-400' }
}

function sortRows(rows, sortBy, order) {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    const dir = order === 'asc' ? 1 : -1
    if (sortBy === 'keyword') return String(a.keyword || '').localeCompare(String(b.keyword || '')) * dir
    if (sortBy === 'volume') return (Number(a.volume || a.est_volume || 0) - Number(b.volume || b.est_volume || 0)) * dir
    if (sortBy === 'difficulty') return (Number(a.difficulty || 0) - Number(b.difficulty || 0)) * dir

    const pa = priorityMeta(a).label
    const pb = priorityMeta(b).label
    const rank = { High: 3, Medium: 2, Low: 1 }
    return (rank[pa] - rank[pb]) * dir
  })
  return sorted
}

function toGoogleAdsPayload(ads) {
  const heads = ads?.google_ads?.headlines || []
  const desc = ads?.google_ads?.descriptions || []
  const headlineBlock = heads.map((item, i) => `${i + 1}. ${item}`).join('\n')
  const descriptionBlock = desc.map((item, i) => `${i + 1}. ${item}`).join('\n')
  return `GOOGLE ADS\nHeadlines:\n${headlineBlock}\n\nDescriptions:\n${descriptionBlock}`
}

function makeCampaignPackText({ companyName, content, emails, seo, ads, strategy }) {
  const generated = new Date().toLocaleString()
  const variants = content?.ad_variants || []
  const sequence = emails?.sequence || []
  const keywords = seo?.target_keywords || []
  const googleHeads = ads?.google_ads?.headlines || []

  const adCopy = variants
    .map((v, i) => `Variant ${i + 1}:\nHeadline: ${v.headline || ''}\nBody: ${v.body || ''}\nCTA: ${v.cta || ''}`)
    .join('\n\n')

  const emailCopy = sequence
    .map((mail, i) => `Email ${i + 1} (Day ${mail.day ?? i * 3}):\nSubject: ${mail.subject || ''}\nPreview: ${mail.preview_text || ''}`)
    .join('\n\n')

  const seoCopy = keywords
    .slice(0, 20)
    .map((k, i) => {
      const d = difficultyMeta(k.difficulty).label
      return `${i + 1}. ${k.keyword || ''} (Vol: ${Number(k.volume || 0).toLocaleString()} | ${d[0].toUpperCase()}${d.slice(1)})`
    })
    .join('\n')

  const headsCopy = googleHeads.map((h, i) => `${i + 1}. ${h}`).join('\n')

  return `===========================\nMARKETMIND CAMPAIGN PACK\nCompany: ${companyName || 'Brewed Awakening'}\nGenerated: ${generated}\n===========================\n\nAD COPY\n-------\n${adCopy || 'No ad variants generated.'}\n\nEMAIL SEQUENCE\n--------------\n${emailCopy || 'No emails generated.'}\n\nSEO KEYWORDS\n------------\n${seoCopy || 'No keywords generated.'}\n\nGOOGLE ADS\n----------\nHeadlines:\n${headsCopy || 'No headlines generated.'}\n\nSTRATEGY\n--------\nROI: ${strategy?.roi ?? 'n/a'}`
}

function OutputPreviews({ campaignId, companyName }) {
  const [content, setContent] = useState(null)
  const [emails, setEmails] = useState(null)
  const [seo, setSeo] = useState(null)
  const [ads, setAds] = useState(null)
  const [strategy, setStrategy] = useState(null)
  const [activeTab, setActiveTab] = useState('content')
  const [loading, setLoading] = useState(false)
  const [emailModal, setEmailModal] = useState(null)
  const [openSection, setOpenSection] = useState(0)
  const [sortBy, setSortBy] = useState('volume')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchFile = async (file) => {
    if (!campaignId) return null
    const response = await fetch(`${ORCHESTRATOR_URL}/outputs/${campaignId}/${file}`)
    if (!response.ok) return null
    const payload = await response.json()
    if (payload?.error) return null
    return payload
  }

  const ensureTabLoaded = async (tab) => {
    setLoading(true)
    try {
      if (tab === 'content' && !content) {
        const payload = await fetchFile('content.json')
        setContent(payload?.content || null)
      }
      if (tab === 'emails' && !emails) {
        const payload = await fetchFile('emails.json')
        setEmails(payload?.emails || null)
      }
      if (tab === 'seo' && !seo) {
        const payload = await fetchFile('seo_brief.json')
        setSeo(payload?.seo_brief || null)
      }
      if (tab === 'ads' && !ads) {
        const payload = await fetchFile('ads.json')
        setAds(payload?.ads || null)
      }
      if (!strategy) {
        const payload = await fetchFile('strategy.json')
        setStrategy(payload?.strategy || null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ensureTabLoaded(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, campaignId])

  const keywords = useMemo(() => sortRows(seo?.target_keywords || [], sortBy, sortOrder), [seo, sortBy, sortOrder])

  const onSort = (field) => {
    if (sortBy === field) {
      setSortOrder((v) => (v === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortOrder(field === 'keyword' ? 'asc' : 'desc')
  }

  const onDownloadPack = async () => {
    const [contentPayload, emailsPayload, seoPayload, adsPayload, strategyPayload] = await Promise.all([
      fetchFile('content.json'),
      fetchFile('emails.json'),
      fetchFile('seo_brief.json'),
      fetchFile('ads.json'),
      fetchFile('strategy.json'),
    ])

    const text = makeCampaignPackText({
      companyName: companyName || 'Brewed Awakening',
      content: contentPayload?.content || content,
      emails: emailsPayload?.emails || emails,
      seo: seoPayload?.seo_brief || seo,
      ads: adsPayload?.ads || ads,
      strategy: strategyPayload?.strategy || strategy,
    })

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'brewed-awakening-campaign-pack.txt'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const blogMeta = seo?.meta_tags || seo?.meta || {}

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-[19px] ${activeTab === tab.key ? 'border-b-2 border-accent text-text-primary' : 'text-text-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-text-secondary">Loading outputs...</p> : null}

      {activeTab === 'content' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(content?.ad_variants || []).map((item, idx) => {
              const copyText = `Headline: ${item.headline || ''}\nBody: ${item.body || ''}\nCTA: ${item.cta || ''}`
              return (
              <div key={idx} className="rounded-xl border border-border bg-card px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-canvas px-2 py-1 text-xs text-text-secondary">Variant {idx + 1}</span>
                  <CopyButton text={copyText} />
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-text-primary">{item.headline}</h3>
                <p className="mt-2 text-base text-text-secondary">{item.body}</p>
                <button className="mt-4 w-full cursor-default rounded-lg bg-accent px-4 py-2 text-base font-semibold text-white">{item.cta || 'Call to Action'}</button>
              </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {(content?.social_posts || []).map((post, idx) => {
              const isTwitter = String(post.channel || '').toLowerCase().includes('twitter')
              const icon = isTwitter ? '🐦' : 'in'
              return (
              <div key={idx} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-accent">{icon} {isTwitter ? 'Twitter' : 'LinkedIn'}</p>
                  {isTwitter ? <span className="text-xs text-text-secondary">{(post.text || '').length} chars</span> : null}
                </div>
                <p className="mt-2 text-base text-text-primary">{post.text}</p>
                <div className="mt-3">
                  <CopyButton text={post.text || ''} />
                </div>
              </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <h3 className="text-xl font-semibold text-text-primary">Blog Outline</h3>
            <p className="mt-2 text-lg font-semibold text-text-primary">{content?.blog_outline?.title || 'No blog outline generated yet.'}</p>
            <div className="mt-3 space-y-2">
              {(content?.blog_outline?.sections || []).map((section, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-canvas">
                  <button onClick={() => setOpenSection(openSection === idx ? -1 : idx)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                    <span className="text-sm font-medium text-text-primary">{section.heading}</span>
                    <span className="text-xs text-text-secondary">{openSection === idx ? '−' : '+'}</span>
                  </button>
                  {openSection === idx ? (
                    <ul className="list-disc space-y-1 px-8 pb-3 text-sm text-text-secondary">
                      {(section.key_points || []).map((point, pointIdx) => (
                        <li key={pointIdx}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="space-y-4">
          {(emails?.sequence || []).map((mail, idx) => {
            const subjectA = mail.subject || 'Generated subject'
            const subjectB = mail.subject_b || `${subjectA} — Limited Time`
            return (
            <div key={idx} className="rounded-xl border border-border bg-card px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-accent">Email {idx + 1} — Send on Day {mail.day ?? idx * 3}</p>
                  <p className="mt-1 text-base font-semibold text-text-primary">A: "{subjectA}"</p>
                  <p className="text-base font-semibold text-text-primary">B: "{subjectB}"</p>
                  <p className="mt-2 text-sm text-text-secondary">{mail.preview_text}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setEmailModal(mail)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">Preview Email</button>
                  <CopyButton text={mail.html_body || ''} label="📋 Copy HTML" />
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {activeTab === 'seo' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="cursor-pointer py-2" onClick={() => onSort('keyword')}>Keyword</th>
                  <th className="cursor-pointer py-2" onClick={() => onSort('volume')}>Est. Volume</th>
                  <th className="cursor-pointer py-2" onClick={() => onSort('difficulty')}>Difficulty</th>
                  <th className="cursor-pointer py-2" onClick={() => onSort('priority')}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((row, idx) => {
                  const d = difficultyMeta(row.difficulty)
                  const p = priorityMeta(row)
                  return (
                  <tr key={idx} className="border-b border-border text-text-primary">
                    <td className="py-2">{row.keyword}</td>
                    <td>{Number(row.volume || row.est_volume || 0).toLocaleString()}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${d.cls}`}>{d.label}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} /> {p.label}
                      </span>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <p className="text-sm text-text-secondary">Google preview</p>
            <p className="mt-1 text-base font-medium text-blue-400">{String(blogMeta.title || '').slice(0, 60)}</p>
            <p className="text-xs text-green-500">yourwebsite.com</p>
            <p className="mt-1 text-sm text-text-secondary">{String(blogMeta.description || '').slice(0, 155)}</p>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <h3 className="text-lg font-semibold text-text-primary">Blog Titles</h3>
            <div className="mt-3 space-y-2">
              {(seo?.blog_titles || []).map((title, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2">
                  <p className="text-sm text-text-primary">{idx + 1}. {title}</p>
                  <CopyButton text={title} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Google Ads</h3>
              <CopyButton text={toGoogleAdsPayload(ads)} label="📋 Copy All" />
            </div>

            <p className="mb-2 text-sm font-medium text-text-secondary">Headlines</p>
            <div className="space-y-2">
              {(ads?.google_ads?.headlines || []).map((headline, idx) => {
                const len = String(headline || '').length
                const ok = len <= 30
                return (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2">
                    <p className="text-sm text-text-primary">{idx + 1}. {headline}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-success/20 text-success' : 'bg-red-500/20 text-red-300'}`}>{len}/30</span>
                  </div>
                )
              })}
            </div>

            <p className="mb-2 mt-4 text-sm font-medium text-text-secondary">Descriptions</p>
            <div className="space-y-2">
              {(ads?.google_ads?.descriptions || []).map((description, idx) => {
                const len = String(description || '').length
                const ok = len <= 90
                return (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2">
                    <p className="text-sm text-text-primary">{idx + 1}. {description}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? 'bg-success/20 text-success' : 'bg-red-500/20 text-red-300'}`}>{len}/90</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <h3 className="text-lg font-semibold text-text-primary">Meta Ads</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {(ads?.meta_ads?.primary_texts || []).map((text, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-canvas px-3 py-3">
                  <p className="text-sm text-text-primary">{text}</p>
                  <div className="mt-2">
                    <CopyButton text={text} />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm font-medium text-text-secondary">Targeting Suggestions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[ads?.audience_targeting?.core, ads?.audience_targeting?.geo, ads?.audience_targeting?.age, ...(ads?.audience_targeting?.interests || [])]
                .filter(Boolean)
                .map((pill, idx) => (
                  <span key={idx} className="rounded-full border border-border bg-canvas px-2.5 py-1 text-xs text-text-primary">{pill}</span>
                ))}
            </div>
          </div>
        </div>
      )}

      {campaignId && (
        <button onClick={onDownloadPack} className="block w-full rounded-xl bg-accent px-5 py-3 text-center text-[22px] font-semibold text-white hover:opacity-90">
          ↓ Download Campaign Pack
        </button>
      )}

      {emailModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-lg font-semibold text-text-primary">Email Preview</h3>
              <button onClick={() => setEmailModal(null)} className="rounded border border-border px-3 py-1 text-sm text-text-secondary">Close</button>
            </div>
            <div className="h-[70vh] bg-white">
              <iframe title="Email Preview" srcDoc={emailModal.html_body || '<p>No email body.</p>'} className="h-full w-full border-0" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OutputPreviews
