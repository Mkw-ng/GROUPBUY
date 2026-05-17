import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminOrders from "./pages/AdminOrders";
import AdminDrops from "./pages/AdminDrops";
import AdminDropAnalytics from "./pages/AdminDropAnalytics";
import AdminCustomers from "./pages/AdminCustomers";
import AdminCustomerProfile from "./pages/AdminCustomerProfile";
import MyStats from "./pages/MyStats";
import OrderSuccess from "./pages/OrderSuccess";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/admin/orders"} component={AdminOrders} />
      <Route path={"/admin/drops"} component={AdminDrops} />
      <Route path={"/admin/drops/:dropId"} component={AdminDropAnalytics} />
      <Route path={"/admin/customers"} component={AdminCustomers} />
      <Route path={"/admin/customers/:phone"} component={AdminCustomerProfile} />
      <Route path={"/my-stats"} component={MyStats} />
      <Route path={"/order-success"} component={OrderSuccess} />
      <Route path={"/404"} component={NotFound} />
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
