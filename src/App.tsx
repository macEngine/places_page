import { LocaleProvider } from './hooks/useLocale';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './core/theme';
import Dashboard from './themes/dashboard';

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>
  );
}
