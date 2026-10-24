import { createRoot } from 'react-dom/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BeheerPage from './pages/BeheerPage';
import WaarschuwingenPage from './pages/WaarschuwingenPage';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  const root = createRoot(rootElement);
  const path = window.location.pathname;

  // Choose the page based on the URL.
  if (path === '/dashboard') {
    root.render(<DashboardPage />);
  } else if (path === '/beheer') {
    root.render(<BeheerPage />);
  } else if (path === '/waarschuwingen') {
    root.render(<WaarschuwingenPage />);
  } else {
    root.render(<LoginPage />);
  }
}