import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TONES = ['professional', 'casual', 'bold']

function Step3BrandVoiceLaunchPage({ session }) {
  const navigate = useNavigate()
  const { fields, setField, startCampaign, status } = session
  const [launching, setLaunching] = useState(false)

  const handleLaunch = async () => {
    setLaunching(true)
    const result = await startCampaign()
    setLaunching(false)
    if (result?.ok) {
      navigate('/live-monitor')
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-7">
      <h2 className="text-[42px] font-semibold leading-tight text-text-primary">Brand voice and guidelines</h2>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-[17px] text-text-secondary">Company Name</span>
          <input
            value={fields.companyName}
            onChange={(event) => setField.setCompanyName(event.target.value)}
            className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[17px] text-text-secondary">Product Description</span>
          <textarea
            rows={3}
            value={fields.productDescription}
            onChange={(event) => setField.setProductDescription(event.target.value)}
            className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[17px] text-text-secondary">Unique Selling Proposition</span>
          <input
            value={fields.usp}
            onChange={(event) => setField.setUsp(event.target.value)}
            className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
          />
        </label>

        <div>
          <span className="mb-2 block text-[17px] text-text-secondary">Tone</span>
          <div className="grid grid-cols-3 gap-3">
            {TONES.map((tone) => {
              const selected = fields.toneOfVoice === tone
              return (
                <button
                  key={tone}
                  onClick={() => setField.setToneOfVoice(tone)}
                  className={`rounded-lg border px-4 py-3 text-[18px] capitalize transition ${
                    selected ? 'border-accent bg-accent text-white' : 'border-border bg-canvas text-text-secondary'
                  }`}
                >
                  {tone}
                </button>
              )
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-[17px] text-text-secondary">Brand Guidelines (optional)</span>
          <textarea
            rows={3}
            value={fields.brandGuidelines}
            onChange={(event) => setField.setBrandGuidelines(event.target.value)}
            className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <span className="text-[17px] text-text-secondary">Step 3 of 3</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/new-campaign/step-2')}
            className="rounded-lg border border-border bg-canvas px-6 py-3 text-[18px] text-text-primary"
          >
            Back
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching || status === 'starting' || status === 'running'}
            className="rounded-lg bg-accent px-7 py-3 text-[18px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {launching || status === 'starting' ? 'Launching...' : 'Launch Campaign'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default Step3BrandVoiceLaunchPage
