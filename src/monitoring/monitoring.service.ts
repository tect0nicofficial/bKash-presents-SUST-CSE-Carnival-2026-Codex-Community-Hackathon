import { Injectable } from '@nestjs/common';

interface MetricKey {
  method: string;
  url: string;
  status?: number;
}

@Injectable()
export class MonitoringService {
  private requestCounts = new Map<string, number>();
  private latencySums = new Map<string, number>();
  private latencyCounts = new Map<string, number>();
  private static readonly MAX_KEYS = 10000;

  private formatKey(parts: MetricKey): string {
    const method = parts.method.replace(/"/g, '');
    const url = parts.url.replace(/"/g, '');
    if (parts.status !== undefined) {
      return `${method}|${url}|${parts.status}`;
    }
    return `${method}|${url}`;
  }

  private evictIfNeeded(): void {
    if (this.requestCounts.size < MonitoringService.MAX_KEYS) return;
    const oldestKey = this.requestCounts.keys().next().value;
    if (oldestKey) this.requestCounts.delete(oldestKey);
  }

  recordRequest(
    method: string,
    url: string,
    status: number,
    durationSeconds: number,
  ) {
    const countKey = this.formatKey({ method, url, status });
    const latencyKey = this.formatKey({ method, url });

    this.evictIfNeeded();
    this.requestCounts.set(
      countKey,
      (this.requestCounts.get(countKey) || 0) + 1,
    );

    this.latencySums.set(
      latencyKey,
      (this.latencySums.get(latencyKey) || 0) + durationSeconds,
    );
    this.latencyCounts.set(
      latencyKey,
      (this.latencyCounts.get(latencyKey) || 0) + 1,
    );
  }

  getMetricsString(): string {
    let output = '';

    output += '# HELP http_requests_total Total number of HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';
    for (const [key, count] of this.requestCounts) {
      const parts = key.split('|');
      output += `http_requests_total{method="${parts[0]}",url="${parts[1]}",status="${parts[2] || ''}"} ${count}\n`;
    }

    output +=
      '# HELP http_request_duration_seconds Average latency of HTTP requests\n';
    output += '# TYPE http_request_duration_seconds gauge\n';
    for (const [key, sum] of this.latencySums) {
      const count = this.latencyCounts.get(key) || 1;
      const avg = sum / count;
      const parts = key.split('|');
      output += `http_request_duration_seconds{method="${parts[0]}",url="${parts[1]}"} ${avg}\n`;
    }

    return output;
  }
}
