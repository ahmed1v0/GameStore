import type { HealthRepository, HealthStatus } from "../domain/health";

export const getHealth = (repository: HealthRepository): Promise<HealthStatus> =>
  repository.get();
