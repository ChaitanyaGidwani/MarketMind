function AppShell({ topBar, sidebar, children }) {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      {topBar}
      <div className="mx-auto flex w-[1440px] max-w-[1440px]">
        {sidebar}
        <main className="min-h-[calc(100vh-64px)] flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
