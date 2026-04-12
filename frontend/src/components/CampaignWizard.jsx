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
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-2xl font-semibold">MarketMind</h1>
      <p className="mt-2 text-sm text-slate-400">Multi-agent marketing campaign orchestrator</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-slate-300">Company Name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Product Description</span>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={productDescription}
            onChange={(e) => onProductDescriptionChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Unique Selling Proposition</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={usp}
            onChange={(e) => onUspChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Tone of Voice</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={toneOfVoice}
            onChange={(e) => onToneOfVoiceChange(e.target.value)}
          >
            <option value="professional">professional</option>
            <option value="casual">casual</option>
            <option value="bold">bold</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Goal</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Audience</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            value={audience}
            onChange={(e) => onAudienceChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Budget ($)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            type="number"
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Timeline (days)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2"
            type="number"
            value={timelineDays}
            onChange={(e) => onTimelineDaysChange(e.target.value)}
          />
        </label>

        <button
          onClick={onStart}
          className="w-full rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400"
        >
          Start Campaign
        </button>
      </div>
    </section>
  )
}

export default CampaignWizard
