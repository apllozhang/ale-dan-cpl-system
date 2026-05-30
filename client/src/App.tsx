﻿import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductDataPage from "./pages/ProductDataPage";
import Summary from "./pages/Summary";
import Import from "./pages/Import";
import QuotationList from "./pages/QuotationList";
import QuotationDetail from "./pages/QuotationDetail";
import UserManagement from "./pages/UserManagement";
import ActivityLog from "./pages/ActivityLog";
import BusinessAnalysis from "./pages/BusinessAnalysis";
import Customers from "./pages/Customers";
import ProductSpecsPage, { SpecSetDetail } from "@/pages/ProductSpecsPage";

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/data" component={ProductDataPage} />
        <Route path="/summary" component={Summary} />
        <Route path="/import" component={Import} />
        <Route path="/quotations" component={QuotationList} />
        <Route path="/quotations/new" component={QuotationDetail} />
        <Route path="/quotations/:id" component={QuotationDetail} />
        <Route path="/users" component={UserManagement} />
        <Route path="/activity" component={ActivityLog} />
        <Route path="/stats" component={BusinessAnalysis} />
        <Route path="/customers" component={Customers} />
        <Route path="/data/specs/:setId" component={({ params }) => <SpecSetDetail setId={Number(params!.setId)} onBack={() => window.location.href = "/data"} />} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/share/:token" component={() => {
        // Lazy load to avoid circular deps
        const QuotationShared = require("./pages/QuotationShared").default;
        return <QuotationShared />;
      }} />
      <Route component={DashboardRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
