﻿import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "@/features/dashboard/pages/Home";
import Login from "@/features/auth/pages/Login";
import ProductDataPage from "@/features/cpl-data/pages/ProductDataPage";
import Summary from "@/features/cpl-data/pages/Summary";
import Import from "@/features/cpl-data/pages/Import";
import QuotationList from "@/features/quotations/pages/QuotationList";
import QuotationDetail from "@/features/quotations/pages/QuotationDetail";
import UserManagement from "@/features/admin/pages/UserManagement";
import ActivityLog from "@/features/admin/pages/ActivityLog";
import BusinessAnalysis from "@/features/dashboard/pages/BusinessAnalysis";
import Customers from "@/features/customers/pages/Customers";
import ProductSpecsPage, { SpecSetDetail } from "@/features/product-specs/pages/ProductSpecsPage";
import CertificationsPage from "@/features/certifications/pages/CertificationsPage";
import EFlashPage from "@/features/eflash/pages/EFlashPage";

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/data" component={ProductDataPage} />
        <Route path="/certifications" component={CertificationsPage} />
        <Route path="/eflash" component={EFlashPage} />
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
        const QuotationShared = require("@/features/quotations/pages/QuotationShared").default;
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
