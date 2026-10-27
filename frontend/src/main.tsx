import { createRoot } from 'react-dom/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SensordataPage from './pages/SensordataPage';
import BeheerPage from './pages/BeheerPage';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  const root = createRoot(rootElement);
  const path = window.location.pathname;

  // Choose the page based on the URL.
  if (path === '/dashboard') {
    root.render(<DashboardPage />);
  } else if (path === '/sensordata') {
    root.render(<SensordataPage />);
  } else if (path === '/beheer') {
    root.render(<BeheerPage />);
  } else {
    root.render(<LoginPage />);
  }
}