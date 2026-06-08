import { useMemo, useState } from 'react'
import FundCampaign from './FundCampaign'
import CampaignStatus from './CampaignStatus'

function InputField({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

function CampaignWizard({
  goal,
  audience,
  budget,
  companyName,
  productDescription,
  usp,
  toneOfVoice,
  timelineDays,
  onGoalChange,
  onAudienceChange,
  onBudgetChange,
  onCompanyNameChange,
  onProductDescriptionChange,
  onUspChange,
  onToneOfVoiceChange,
  onTimelineDaysChange,
  onStart,
  status,
  contractAddress,
  campaignId,
}) {
  const [onChainFunded, setOnChainFunded] = useState(false)
  const [step, setStep] = useState(1)
  const stepTitle = useMemo(() => {
    if (step === 1) return 'Company Context'
    if (step === 2) return 'Campaign Strategy'
    return 'Execution Parameters'
  }, [step])

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Campaign Builder</h2>
          <p className="mt-1 text-sm text-text-secondary">Step {step} of 3</p>
        </div>
        <div className="text-sm text-text-secondary">{stepTitle}</div>
      </div>

      <div className="mb-5 flex gap-2">
        {[1, 2, 3].map((index) => (
          <div key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-canvas p-5 transition-all duration-300">
        <div className={`space-y-4 transition-all duration-300 ${step === 1 ? 'opacity-100 translate-y-0' : 'opacity-90'}`}>
          {step === 1 && (
            <>
              <InputField label="Company Name">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 placeholder:text-text-secondary focus:ring"
                  value={companyName}
                  onChange={(e) => onCompanyNameChange(e.target.value)}
                />
              </InputField>

              <InputField label="Product Description">
                <textarea
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 placeholder:text-text-secondary focus:ring"
                  rows={4}
                  value={productDescription}
                  onChange={(e) => onProductDescriptionChange(e.target.value)}
                />
              </InputField>

              <InputField label="Unique Selling Proposition">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 placeholder:text-text-secondary focus:ring"
                  value={usp}
                  onChange={(e) => onUspChange(e.target.value)}
                />
              </InputField>
            </>
          )}
        </div>

        <div className={`space-y-4 transition-all duration-300 ${step === 2 ? 'opacity-100 translate-y-0' : 'opacity-90'}`}>
          {step === 2 && (
            <>
              <InputField label="Campaign Goal">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 placeholder:text-text-secondary focus:ring"
                  value={goal}
                  onChange={(e) => onGoalChange(e.target.value)}
                />
              </InputField>

              <InputField label="Target Audience">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 placeholder:text-text-secondary focus:ring"
                  value={audience}
                  onChange={(e) => onAudienceChange(e.target.value)}
                />
              </InputField>

              <InputField label="Tone of Voice">
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 focus:ring"
                  value={toneOfVoice}
                  onChange={(e) => onToneOfVoiceChange(e.target.value)}
                >
                  <option value="professional">professional</option>
                  <option value="casual">casual</option>
                  <option value="bold">bold</option>
                </select>
              </InputField>
            </>
          )}
        </div>

        <div className={`space-y-4 transition-all duration-300 ${step === 3 ? 'opacity-100 translate-y-0' : 'opacity-90'}`}>
          {step === 3 && (
            <>
              <InputField label="Budget (USD)">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 focus:ring"
                  type="number"
                  value={budget}
                  onChange={(e) => onBudgetChange(e.target.value)}
                />
              </InputField>

              <InputField label="Timeline (days)">
                <input
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-text-primary outline-none ring-accent/30 focus:ring"
                  type="number"
                  value={timelineDays}
                  onChange={(e) => onTimelineDaysChange(e.target.value)}
                />
              </InputField>

              <div className="mt-4">
                <h3 className="text-sm text-text-secondary">On-chain Funding</h3>
                <div className="mt-2">
                  {/* Wallet + fund UI */}
                  <div className="space-y-2">
                    {/* Wallet provider wrapper */}
                    <div>
                      {/* Lazy load wallet UI: simple FundCampaign + Status components */}
                      {/* These components expect a contractAddress and campaignId in production */}
                      <div className="flex gap-4">
                        <div>
                          {/* eslint-disable-next-line react/jsx-pascal-case */}
                          <FundCampaign contractAddress={contractAddress} campaignId={campaignId} onFunded={() => setOnChainFunded(true)} />
                        </div>
                        <div>
                          <CampaignStatus contractAddress={contractAddress} campaignId={campaignId} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-border bg-canvas px-4 py-2 text-sm text-text-secondary disabled:opacity-40"
        >
          Back
        </button>

        {step < 3 ? (
          <button onClick={() => setStep((s) => Math.min(3, s + 1))} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Continue
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!onChainFunded}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {status === 'starting' || status === 'running' ? 'Launching...' : 'Launch Campaign'}
          </button>
        )}
      </div>
    </section>
  )
}

export default CampaignWizard
