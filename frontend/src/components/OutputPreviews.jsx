function OutputPreviews({ outputs, campaignId }) {
  const content = outputs['content.json'] || outputs.content_json || null
  const emails = outputs['emails.json'] || outputs.emails_json || null
  const seo = outputs['seo_brief.json'] || outputs.seo_brief_json || null
  const ads = outputs['ads.json'] || outputs.ads_json || null
  const strategy = outputs['strategy.json'] || outputs.strategy_json || null

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Results</h2>
        {campaignId && (
          <a
            className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
            href={`http://localhost:8001/outputs/${campaignId}/download`}
          >
            Download All
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-slate-800 p-4">
          <h3 className="font-medium">Content Pack</h3>
          {content ? (
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="text-slate-400">Ad Variants</div>
                {(content.ad_variants || []).map((item, idx) => (
                  <div key={idx} className="mt-2 rounded bg-slate-950 p-2">
                    <div className="font-medium">{item.headline}</div>
                    <div>{item.body}</div>
                    <div className="text-cyan-300">CTA: {item.cta}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-slate-400">Social Posts</div>
                {(content.social_posts || []).map((post, idx) => (
                  <div key={idx} className="mt-1 rounded bg-slate-950 p-2">[{post.channel}] {post.text}</div>
                ))}
              </div>
            </div>
          ) : <p className="mt-2 text-sm text-slate-400">Not ready yet.</p>}
        </div>

        <div className="rounded border border-slate-800 p-4">
          <h3 className="font-medium">Email Sequence</h3>
          {emails?.sequence ? (
            <div className="mt-3 space-y-3 text-sm">
              {emails.sequence.map((mail, idx) => (
                <div key={idx} className="rounded bg-slate-950 p-2">
                  <div className="font-medium">Day {mail.day}: {mail.subject}</div>
                  <div className="text-slate-400">{mail.preview_text}</div>
                  <div className="mt-2 rounded border border-slate-800 bg-white p-2 text-slate-900" dangerouslySetInnerHTML={{ __html: mail.html_body }} />
                </div>
              ))}
            </div>
          ) : <p className="mt-2 text-sm text-slate-400">Not ready yet.</p>}
        </div>

        <div className="rounded border border-slate-800 p-4">
          <h3 className="font-medium">SEO Brief</h3>
          {seo ? (
            <div className="mt-3 overflow-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400"><th>Keyword</th><th>Difficulty</th><th>Volume</th></tr>
                </thead>
                <tbody>
                  {(seo.target_keywords || []).map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-800"><td>{row.keyword}</td><td>{row.difficulty}</td><td>{row.volume}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-sm text-slate-400">Not ready yet.</p>}
        </div>

        <div className="rounded border border-slate-800 p-4">
          <h3 className="font-medium">Ads Brief</h3>
          {ads ? (
            <pre className="mt-3 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(ads, null, 2)}</pre>
          ) : <p className="mt-2 text-sm text-slate-400">Not ready yet.</p>}
        </div>

        <div className="rounded border border-slate-800 p-4 lg:col-span-2">
          <h3 className="font-medium">Strategy Report</h3>
          {strategy ? (
            <pre className="mt-3 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(strategy, null, 2)}</pre>
          ) : <p className="mt-2 text-sm text-slate-400">Not ready yet.</p>}
        </div>
      </div>
    </section>
  )
}

export default OutputPreviews
