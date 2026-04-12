import { useMemo, useState } from 'react'

const TABS = [
  { key: 'content', label: 'Content Pack' },
  { key: 'emails', label: 'Email Sequence' },
  { key: 'seo', label: 'SEO Brief' },
  { key: 'ads', label: 'Ads Copy' },
]

function OutputPreviews({ outputs, campaignId }) {
  const content = outputs['content.json'] || outputs.content_json || null
  const emails = outputs['emails.json'] || outputs.emails_json || null
  const seo = outputs['seo_brief.json'] || outputs.seo_brief_json || null
  const ads = outputs['ads.json'] || outputs.ads_json || null
  const strategy = outputs['strategy.json'] || outputs.strategy_json || null
  const [activeTab, setActiveTab] = useState('content')

  const socialPosts = useMemo(() => (content?.social_posts || []).slice(0, 5), [content])

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

      {activeTab === 'content' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {(content?.ad_variants || []).slice(0, 3).map((item, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-canvas px-2 py-1 text-xs text-text-secondary">Variant {idx + 1}</span>
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">{91 - idx * 4}%</span>
                </div>
                <h3 className="text-[34px] font-semibold leading-tight text-text-primary">{item.headline || 'Variant headline'}</h3>
                <p className="mt-3 text-[20px] text-text-secondary">{item.body || 'Generated body copy will appear here.'}</p>
                <button className="mt-5 w-full rounded-lg bg-accent px-4 py-2 text-[18px] font-semibold text-white">{item.cta || 'Start Free Trial'}</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-3">
            {socialPosts.map((post, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card px-3 py-3">
                <p className="text-xs text-accent">{post.channel}</p>
                <p className="mt-1 text-[16px] text-text-primary">{post.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="grid gap-4">
          {(emails?.sequence || []).map((mail, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card px-4 py-4">
              <p className="text-xs text-accent">Day {mail.day}</p>
              <h3 className="mt-1 text-[30px] font-semibold text-text-primary">{mail.subject}</h3>
              <p className="mt-1 text-[18px] text-text-secondary">{mail.preview_text}</p>
              <div className="mt-3 rounded-lg border border-border bg-white p-3 text-black" dangerouslySetInnerHTML={{ __html: mail.html_body }} />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'seo' && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          {seo ? (
            <table className="w-full text-[18px]">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-2">Keyword</th>
                  <th className="pb-2">Difficulty</th>
                  <th className="pb-2">Volume</th>
                </tr>
              </thead>
              <tbody>
                {(seo.target_keywords || []).slice(0, 18).map((row, idx) => (
                  <tr key={idx} className="border-b border-border text-text-primary">
                    <td className="py-2">{row.keyword}</td>
                    <td>{row.difficulty}</td>
                    <td>{row.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-text-secondary">SEO brief not ready yet.</p>
          )}
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <pre className="max-h-[450px] overflow-auto rounded-lg border border-border bg-canvas p-3 text-sm text-text-secondary">{JSON.stringify(ads || strategy || {}, null, 2)}</pre>
        </div>
      )}

      {campaignId && (
        <a
          className="block w-full rounded-xl bg-accent px-5 py-3 text-center text-[24px] font-semibold text-white hover:opacity-90"
          href={`http://localhost:8001/outputs/${campaignId}/download`}
        >
          ↓ Download Complete Campaign Pack
        </a>
      )}
    </section>
  )
}

export default OutputPreviews
