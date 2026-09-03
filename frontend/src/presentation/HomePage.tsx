import { useEffect, useState } from "react";

import { getHealth } from "../application/getHealth";
import type { HealthStatus } from "../domain/health";
import { httpHealthRepository } from "../infrastructure/httpHealthRepository";

export function HomePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth(httpHealthRepository).then(setHealth).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unknown API error");
    });
  }, []);

  return (
    <main className="shell">
      <p className="eyebrow">Django + React + PostgreSQL</p>
      <h1>The foundation is ready.</h1>
      <p className="lede">
        Start the API and database, then build each business capability as its
        own bounded context.
      </p>
      <section className="status" aria-live="polite">
        <span className={`dot ${health ? "online" : error ? "offline" : ""}`} />
        {health
          ? `API ${health.service} connected to PostgreSQL`
          : error
            ? `API unavailable: ${error}`
            : "Checking API connection…"}
      </section>
    </main>
  );
}
