export default function SignInLayout({ children }: LayoutProps<"/sign-in">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Stream Realty Partners · ICM
        </p>
        <h1 className="mt-1 mb-6 text-xl font-semibold">ICM Deal Platform</h1>
        {children}
      </div>
    </main>
  );
}
