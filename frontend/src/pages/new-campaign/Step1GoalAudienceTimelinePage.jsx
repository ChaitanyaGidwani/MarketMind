import { useNavigate } from 'react-router-dom'

function Step1GoalAudienceTimelinePage({ session }) {
  const navigate = useNavigate()
  const { fields, setField } = session

  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-7">
      <h2 className="text-[42px] font-semibold leading-tight text-text-primary">What is your campaign goal?</h2>

      <div className="mt-5 space-y-5">
        <label className="block">
          <textarea
            rows={4}
            value={fields.goal}
            onChange={(event) => setField.setGoal(event.target.value)}
            placeholder="e.g. Launch a product campaign for our AI writing tool targeting startup founders"
            className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[26px] text-text-primary outline-none placeholder:text-text-secondary focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-[17px] text-text-secondary">Target Audience</span>
            <input
              value={fields.audience}
              onChange={(event) => setField.setAudience(event.target.value)}
              className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[17px] text-text-secondary">Timeline</span>
            <select
              value={fields.timelineDays}
              onChange={(event) => setField.setTimelineDays(Number(event.target.value))}
              className="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-[20px] text-text-primary outline-none focus:border-accent"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <span className="text-[17px] text-text-secondary">Step 1 of 3</span>
        <button
          onClick={() => navigate('/new-campaign/step-2')}
          className="rounded-lg bg-accent px-7 py-3 text-[18px] font-semibold text-white hover:opacity-90"
        >
          Next Step →
        </button>
      </div>
    </section>
  )
}

export default Step1GoalAudienceTimelinePage
