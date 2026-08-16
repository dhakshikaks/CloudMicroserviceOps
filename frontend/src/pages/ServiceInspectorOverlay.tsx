import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ServiceInspector from "../components/ServiceInspector";

export default function ServiceInspectorOverlay() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const hasBackground = Boolean((location.state as { backgroundLocation?: unknown } | null)?.backgroundLocation);

  function handleClose() {
    if (hasBackground) {
      navigate(-1);
    } else {
      navigate("/services");
    }
  }

  useEffect(() => {
    if (!hasBackground) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBackground]);

  if (!name) return null;

  return (
    <div className={`service-inspector-overlay${hasBackground ? " as-modal" : ""}`}>
      {hasBackground && <div className="service-inspector-scrim" onClick={handleClose} />}
      <div className="service-inspector-panel">
        <ServiceInspector serviceName={name} onClose={handleClose} />
      </div>
    </div>
  );
}
