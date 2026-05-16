import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import DataViewer from "./pages/DataViewer";
import Summary from "./pages/Summary";
import Import from "./pages/Import";
import QuotationList from "./pages/QuotationList";
import QuotationDetail from "./pages/QuotationDetail";
import UserManagement from "./pages/UserManagement";

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/data" component={DataViewer} />
        <Route path="/summary" component={Summary} />
        <Route path="/import" component={Import} />
        <Route path="/quotations" component={QuotationList} />
        <Route path="/quotations/new" component={QuotationDetail} />
        <Route path="/quotations/:id" component={QuotationDetail} />
        <Route path="/users" component={UserManagement} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={DashboardRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
