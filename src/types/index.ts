export interface DashboardItem {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'pending' | 'completed';
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
}

export interface Config {
  apiUrl: string;
  federationMode: boolean;
}
