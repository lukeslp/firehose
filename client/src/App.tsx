import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import VariantIndex from "./pages/VariantIndex";
import VariantRouter from "./pages/VariantRouter";

function AppRouter() {
  return (
    <Router base="/bluesky/firehose">
      <Switch>
        <Route path={"/"} component={Dashboard} />
        <Route path={"/variants"} component={VariantIndex} />
        <Route path={"/variants/:variantId"} component={VariantRouter} />
        <Route path={"/404"} component={NotFound} />
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
