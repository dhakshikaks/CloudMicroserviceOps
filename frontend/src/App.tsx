import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from "react-router-dom";
import AppShell from "./layouts/AppShell";
import { TimeWindowProvider } from "./context/TimeWindowContext";
import Overview from "./pages/Overview";
import Services from "./pages/Services";
import ServiceInspectorOverlay from "./pages/ServiceInspectorOverlay";
import Topology from "./pages/Topology";
import Metrics from "./pages/Metrics";
import Events from "./pages/Events";
import Incidents from "./pages/Incidents";
import Reports from "./pages/Reports";
import SystemHealth from "./pages/SystemHealth";
import Login from "./pages/Login";
import { getToken } from "./services/auth";

function RequireAuth({ children }: { children: ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

interface NavigationState {
  backgroundLocation?: Location;
}

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = (location.state as NavigationState | undefined)?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation ?? location}>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Overview />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:name" element={<ServiceInspectorOverlay />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/events" element={<Events />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/system/health" element={<SystemHealth />} />
        </Route>
      </Routes>

      {/* Overlay pass: when we navigated here from within the app (background-location
          state present), render the inspector on top of whatever page is still visible
          underneath. Direct links / refreshes have no backgroundLocation, so the main
          Routes block above already rendered it as a normal page - this block stays inert. */}
      {backgroundLocation && (
        <Routes>
          <Route
            path="/services/:name"
            element={
              <RequireAuth>
                <ServiceInspectorOverlay />
              </RequireAuth>
            }
          />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TimeWindowProvider>
        <AppRoutes />
      </TimeWindowProvider>
    </BrowserRouter>
  );
}
