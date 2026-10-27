import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: its double-mount would build the whole city twice in development.
createRoot(document.getElementById('root')!).render(<App />);
