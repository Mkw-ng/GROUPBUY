import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "./const";

const Admin = lazy(() => import("./pages/Admin"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminDrops = lazy(() => import("./pages/AdminDrops"));
const AdminDropAnalytics = lazy(() => import("./pages/AdminDropAnalytics"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const AdminCustomerProfile = lazy(() => import("./pages/AdminCustomerProfile"));
const MyStats = lazy(() => import("./pages/MyStats"));

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Not logged in — send to Manus OAuth login, return here after
      window.location.href = getLoginUrl("/admin");
      return;
    }
    if (user.role !== "admin") {
      // Logged in but not admin — send to home
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading || !user || user.role !== "admin") return null;

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  if (loading || !user) return null;

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
      <Route path={"/admin/drops"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <AdminDrops />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/admin/drops/:dropId"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <AdminDropAnalytics />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/admin/customers"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <AdminCustomers />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/admin/customers/:phone"}>
        <AdminGuard>
          <Suspense fallback={null}>
            <AdminCustomerProfile />
          </Suspense>
        </AdminGuard>
      </Route>
      <Route path={"/my-stats"}>
        <AuthGuard>
          <Suspense fallback={null}>
            <MyStats />
          </Suspense>
        </AuthGuard>
      </Route>
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
