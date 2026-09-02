import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import AccessibilityObservatory from './pages/AccessibilityObservatory';

function AppRouter() {
  const downloadsAlias = window.location.pathname.startsWith('/downloads/bluesky-alt-text');
  const base = downloadsAlias ? '/downloads/bluesky-alt-text' : '/bluesky/firehose';
  return (
    <Router base={base}>
      <Switch>
        {downloadsAlias && <Route path="/" component={AccessibilityObservatory} />}
        <Route path={"/"} component={Dashboard} />
        <Route path="/accessibility/" component={AccessibilityObservatory} />
        <Route path="/accessibility" component={AccessibilityObservatory} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
