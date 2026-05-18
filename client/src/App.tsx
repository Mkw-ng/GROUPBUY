import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminDrops from "./pages/AdminDrops";
import AdminDropAnalytics from "./pages/AdminDropAnalytics";
import AdminCustomers from "./pages/AdminCustomers";
import AdminCustomerProfile from "./pages/AdminCustomerProfile";
import MyStats from "./pages/MyStats";

const Admin = lazy(() => import("./pages/Admin"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading || !user || user.role !== "admin") return null;

  return <>{children}</>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <Admin />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/admin/orders"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <AdminOrders />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/admin/drops"} component={AdminDrops} />
      <Route path={"/admin/drops/:dropId"} component={AdminDropAnalytics} />
      <Route path={"/admin/customers"} component={AdminCustomers} />
      <Route path={"/admin/customers/:phone"} component={AdminCustomerProfile} />
      <Route path={"/my-stats"} component={MyStats} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
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
