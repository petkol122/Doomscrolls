export interface HealthCheckResult {
  readonly ok: boolean;
  readonly status: number;
}

export class ApiClient {
  public constructor(private readonly apiUrl: URL) {}

  public async getHealth(): Promise<HealthCheckResult> {
    const healthUrl = new URL("/health", this.apiUrl);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        credentials: "omit"
      });

      return {
        ok: response.ok,
        status: response.status
      };
    } catch {
      return {
        ok: false,
        status: 0
      };
    }
  }
}