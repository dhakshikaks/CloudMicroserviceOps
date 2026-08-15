import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../services/auth";

export default function Layout({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div>
      <header className="app-header">
        <div>
          <strong>CloudMicroserviceOps</strong>
          <span className="app-header-subtitle">Root-Cause Prediction &amp; Monitoring</span>
        </div>
        {user && (
          <div className="app-header-user">
            <span>
              {user.username} ({user.role})
            </span>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
