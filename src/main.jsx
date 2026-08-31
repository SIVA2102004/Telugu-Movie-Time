import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Application Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#0d0d1a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
          <div style={{ background: "rgba(255,50,50,0.1)", border: "1px solid #ff3344", padding: 24, borderRadius: 12, maxWidth: 460 }}>
            <h2 style={{ color: "#ff3344", margin: "0 0 12px" }}>⚠️ Portal Notice</h2>
            <p style={{ fontSize: "0.9rem", color: "#ccc", margin: "0 0 16px" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.removeItem("telugu_talkies_movie_config");
                window.location.reload();
              }}
              style={{ background: "#FFD700", color: "#000", border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              🔄 Refresh & Clear Cache
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
