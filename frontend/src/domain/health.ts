export type HealthStatus = {
  service: string;
  database: "up" | "down";
};

export interface HealthRepository {
  get(): Promise<HealthStatus>;
}
