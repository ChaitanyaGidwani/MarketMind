function AgentMonitor({ events }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
      <h2 className="text-lg font-semibold">Agent Monitor</h2>
      <div className="mt-4 max-h-[420px] overflow-auto rounded-md border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-slate-200">
            <tr>
              <th className="p-2">Type</th>
              <th className="p-2">Agent</th>
              <th className="p-2">Payload</th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt, idx) => (
              <tr key={`${evt.event_id || 'evt'}-${idx}`} className="border-t border-slate-800">
                <td className="p-2">{evt.event_type}</td>
                <td className="p-2">{evt.agent || '-'}</td>
                <td className="p-2 text-xs text-slate-300">{JSON.stringify(evt.payload)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AgentMonitor
