import type { HealthRepository, HealthStatus } from "../domain/health";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export const httpHealthRepository: HealthRepository = {
  async get(): Promise<HealthStatus> {
    const response = await fetch(`${apiUrl}/health/`);
    const payload = (await response.json()) as HealthStatus;

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return payload;
  },
};
