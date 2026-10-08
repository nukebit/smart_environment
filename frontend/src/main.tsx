import { createRoot } from 'react-dom/client';
import LoginPage from './LoginPage';
import DashboardPage from './DashboardPage';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  const root = createRoot(rootElement);
  const path = window.location.pathname;

  if (path === '/dashboard') {
    root.render(<DashboardPage />);
  } else {
    root.render(<LoginPage />);
  }
}
