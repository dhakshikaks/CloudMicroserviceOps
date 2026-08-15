import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #ddd" }}>
        <strong>CloudMicroserviceOps</strong>
        <span style={{ marginLeft: "0.75rem", color: "#666" }}>
          Root-Cause Prediction &amp; Monitoring
        </span>
      </header>
      <main style={{ padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
