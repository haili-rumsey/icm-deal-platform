export default function SignInLayout({ children }: LayoutProps<"/sign-in">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-navy px-4 py-16">
      <div className="w-full max-w-sm rounded-md bg-card p-8 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
        <img src="/brand/stream-logo-navy.svg" alt="Stream Realty Partners" className="h-8 w-auto" />
        <h1 className="mt-6 mb-6 font-serif text-xl">ICM Deal Platform</h1>
        {children}
      </div>
    </main>
  );
}
