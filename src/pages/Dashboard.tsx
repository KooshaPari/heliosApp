import { useState } from 'react';
import type { DashboardItem } from '../types';
import './Dashboard.css';

export default function Dashboard() {
  const configuredPort = import.meta.env.VITE_PORT ?? '3001';
  const [items] = useState<DashboardItem[]>([
    {
      id: '1',
      title: 'Module Federation Setup',
      description: 'Configures heliosApp as a Module Federation remote module',
      status: 'active',
    },
    {
      id: '2',
      title: 'Component Library',
      description: 'Shared components exportable from this remote',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Documentation',
      description: 'API documentation for federated modules',
      status: 'pending',
    },
  ]);

  return (
    <div className="dashboard">
      <h2>heliosApp Dashboard</h2>
      <p className="subtitle">
        This application is configured as a Module Federation remote module.
      </p>

      <div className="items-grid">
        {items.map((item) => (
          <div key={item.id} className={`item-card status-${item.status}`}>
            <div className="item-header">
              <h3>{item.title}</h3>
              <span className={`status-badge`}>{item.status}</span>
            </div>
            <p className="item-description">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="info-section">
        <h3>Federation Configuration</h3>
        <ul>
          <li>Remote name: <code>heliosApp</code></li>
          <li>Port: <code>{configuredPort}</code></li>
          <li>Exposed modules: <code>Dashboard</code>, <code>Components</code>, <code>Hooks</code></li>
          <li>Shared dependencies: React 18+, React DOM 18+</li>
        </ul>
      </div>
    </div>
  );
}
