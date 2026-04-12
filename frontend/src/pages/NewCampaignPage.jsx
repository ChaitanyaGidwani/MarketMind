import { Outlet, useLocation } from 'react-router-dom'

const STEP_META = {
  'step-1': { order: 1, label: 'Goal / Budget / Brand' },
  'step-2': { order: 2, label: 'Goal / Budget / Brand' },
  'step-3': { order: 3, label: 'Goal / Budget / Brand' },
}

function NewCampaignPage() {
  const location = useLocation()
  const currentStepKey = location.pathname.split('/').pop() || 'step-1'
  const current = STEP_META[currentStepKey] || STEP_META['step-1']

  return (
    <div>
      <div className="mb-8 border-b border-border pb-2">
        <p className="text-xs text-text-secondary">Create / New Campaign</p>
        <h1 className="text-[34px] font-semibold leading-tight text-text-primary">New Campaign</h1>
      </div>

      <div className="mx-auto w-[720px]">
        <div className="mb-6 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${step <= current.order ? 'bg-accent' : 'bg-border'}`} />
                {step < 3 && <span className={`h-[2px] w-12 ${step < current.order ? 'bg-accent' : 'bg-border'}`} />}
              </div>
            ))}
          </div>
          <p className="text-sm text-text-secondary">{current.label}</p>
        </div>

        <Outlet />
      </div>
    </div>
  )
}

export default NewCampaignPage
