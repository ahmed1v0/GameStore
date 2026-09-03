export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Game Store
        </p>
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Digital items, matched to your region.
        </h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
          The storefront foundation is ready. Sign-in, catalog browsing, and purchasing are added
          in the next implementation phases.
        </p>
      </section>
    </main>
  );
}
