import { Plus } from 'lucide-react';
import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function Header({ title, subtitle, onOpenOnboarding }) {
  const [connection, setConnection] = useState("Checking backend");
  useEffect(() => {
    let active = true;
    apiFetch("/health")
      .then(() => {
        if (active) setConnection("Connected");
      })
      .catch(() => {
        if (active) setConnection("Backend unavailable");
      });
    return () => {
      active = false;
    };
  }, [title]);
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title-group">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div
          className="header-business-badge"
          style={{
            background: connection === "Connected" ? "#ecfdf5" : "#fff7ed",
            color: connection === "Connected" ? "#047857" : "#9a3412",
            border: "1px solid #a7f3d0",
          }}
        >
          <span>●</span>
          <span>{connection}</span>
        </div>

        <button
          className="btn btn-yellow"
          onClick={onOpenOnboarding}
          title="Onboard a new business and local voice agent"
        >
          <Plus size={17} />
          <span>Add business</span>
        </button>
      </div>
    </header>
  );
}
