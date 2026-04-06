import { Suspense, lazy } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

export default function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>heliosApp</h1>
        <p>Module Federation Remote</p>
      </header>
      <main className="app-main">
        <Suspense fallback={<div>Loading...</div>}>
          <Dashboard />
        </Suspense>
      </main>
    </div>
  );
}
