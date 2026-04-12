import { useNavigate } from 'react-router-dom'

const CHANNELS = [
  { key: 'google_ads', label: 'Google Ads' },
  { key: 'meta_ads', label: 'Meta Ads' },
  { key: 'email', label: 'Email Marketing' },
  { key: 'seo', label: 'SEO' },
]

function Step2BudgetChannelsPage({ session }) {
  const navigate = useNavigate()
  const { fields, setField } = session

  const selectedChannels = fields.channels || ['google_ads', 'email', 'seo']

  const toggleChannel = (channelKey) => {
    if (channelKey === 'meta_ads') return
    if (selectedChannels.includes(channelKey)) {
      setField.setChannels(selectedChannels.filter((item) => item !== channelKey))
      return
    }
    setField.setChannels([...selectedChannels, channelKey])
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-7">
      <h2 className="text-[42px] font-semibold leading-tight text-text-primary">Set your budget and channels</h2>

      <div className="mt-5">
        <p className="text-[42px] font-semibold text-accent">${Number(fields.budget || 0).toFixed(0)}</p>
        <input
          type="range"
          min={100}
          max={10000}
          step={50}
          value={Number(fields.budget || 500)}
          onChange={(event) => setField.setBudget(Number(event.target.value))}
          className="mt-3 w-full accent-accent"
        />
        <div className="mt-1 flex justify-between text-[14px] text-text-secondary">
          <span>Min $100</span>
          <span>Max $10,000</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[17px] text-text-secondary">Select Channels</p>
        <div className="grid grid-cols-2 gap-3">
          {CHANNELS.map((channel) => {
            const disabled = channel.key === 'meta_ads'
            const selected = selectedChannels.includes(channel.key)
            return (
              <button
                key={channel.key}
                onClick={() => toggleChannel(channel.key)}
                disabled={disabled}
                className={`flex items-center justify-between rounded-lg border px-4 py-4 text-left text-[20px] transition ${
                  disabled
                    ? 'cursor-not-allowed border-border bg-canvas/70 text-text-secondary/60'
                    : selected
                      ? 'border-accent bg-accent/15 text-text-primary'
                      : 'border-border bg-canvas text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{channel.label}</span>
                <span className={`${selected ? 'text-accent' : 'text-transparent'}`}>✓</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <span className="text-[17px] text-text-secondary">Step 2 of 3</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/new-campaign/step-1')}
            className="rounded-lg border border-border bg-canvas px-6 py-3 text-[18px] text-text-primary"
          >
            Back
          </button>
          <button
            onClick={() => navigate('/new-campaign/step-3')}
            className="rounded-lg bg-accent px-7 py-3 text-[18px] font-semibold text-white hover:opacity-90"
          >
            Next Step →
          </button>
        </div>
      </div>
    </section>
  )
}

export default Step2BudgetChannelsPage
