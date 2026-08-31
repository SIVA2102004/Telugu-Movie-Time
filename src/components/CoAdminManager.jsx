import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, deleteDoc, setDoc } from "firebase/firestore";
import { UserCheck, Trash2, KeyRound, Copy, MessageCircle, RefreshCw, ShieldAlert, CheckCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function CoAdminManager({ config, bookings = [] }) {
  const [coAdmins, setCoAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newJoiningCode, setNewJoiningCode] = useState(config?.coAdminCode || "COADMIN2026");
  const [updatingCode, setUpdatingCode] = useState(false);

  // Real-time listener for Co-Admins from Firestore with local fallback
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        collection(db, "coAdmins"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setCoAdmins(list);
          try {
            localStorage.setItem("tmt_co_admins_cache", JSON.stringify(list));
          } catch (e) {}
          setLoading(false);
        },
        (err) => {
          console.warn("Co-admins firestore error, falling back to cache:", err);
          const cached = JSON.parse(localStorage.getItem("tmt_co_admins_cache") || "[]");
          setCoAdmins(cached);
          setLoading(false);
        }
      );
    } catch (e) {
      const cached = JSON.parse(localStorage.getItem("tmt_co_admins_cache") || "[]");
      setCoAdmins(cached);
      setLoading(false);
    }

    return () => unsub();
  }, []);

  // Delete / Revoke Co-Admin Access
  const handleDeleteCoAdmin = async (coAdmin) => {
    if (!window.confirm(`Are you sure you want to remove co-admin "${coAdmin?.name || ""}" (${coAdmin?.phone || ""})? They will lose access to verify bookings.`)) {
      return;
    }

    // 1. Optimistic local update
    setCoAdmins((prev) => {
      const updated = prev.filter((c) => c.id !== coAdmin.id);
      try {
        localStorage.setItem("tmt_co_admins_cache", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    toast.success(`Removed co-admin: ${coAdmin?.name || ""} 🗑️`);

    // 2. Cloud Firestore deletion
    try {
      await deleteDoc(doc(db, "coAdmins", coAdmin.id));
    } catch (err) {
      console.error("Failed to delete co-admin from cloud:", err);
    }
  };

  // Update Joining Code
  const handleUpdateJoiningCode = async (e) => {
    e.preventDefault();
    if (!newJoiningCode.trim()) {
      toast.error("Joining code cannot be empty.");
      return;
    }

    setUpdatingCode(true);
    const updated = {
      ...config,
      coAdminCode: newJoiningCode.trim().toUpperCase(),
    };

    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      await setDoc(doc(db, "movieConfig", "current"), { coAdminCode: newJoiningCode.trim().toUpperCase() }, { merge: true });
      toast.success("Joining Code updated live! 🔑");
    } catch (err) {
      toast.success("Updated joining code locally! 🔑");
    }
    setUpdatingCode(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(config?.coAdminCode || newJoiningCode);
    toast.success("Joining code copied to clipboard! 📋");
  };

  // Count tickets confirmed by each co-admin
  const getConfirmedCount = (adminName) => {
    if (!adminName) return 0;
    return bookings.filter((b) => b.status === "confirmed" && b.confirmedBy === adminName).length;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner: Manage Joining Code */}
      <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, rgba(255,51,68,0.12) 0%, rgba(20,16,24,0.9) 100%)", border: "1px solid var(--gold)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: "var(--gold)", margin: 0, fontSize: "1.3rem", display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={22} /> Co-Admin & Volunteer Management
            </h2>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: "0.86rem" }}>
              Share the joining code with trusted team members so they can verify student payments and issue tickets. You can remove them at any time.
            </p>
          </div>

          <form onSubmit={handleUpdateJoiningCode} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <KeyRound size={16} color="var(--gold)" />
              <input
                className="input"
                style={{ width: 160, padding: "6px 8px", fontSize: "0.88rem", fontWeight: 700, textTransform: "uppercase", background: "transparent", border: "none" }}
                value={newJoiningCode}
                onChange={(e) => setNewJoiningCode(e.target.value)}
                placeholder="COADMIN2026"
              />
              <button type="button" className="btn btn-ghost" style={{ padding: "4px 6px" }} onClick={copyCode} title="Copy Code">
                <Copy size={14} />
              </button>
            </div>
            <button type="submit" className="btn btn-gold" style={{ padding: "8px 16px", fontSize: "0.85rem" }} disabled={updatingCode}>
              {updatingCode ? "Updating..." : "Update Code"}
            </button>
          </form>
        </div>
      </div>

      {/* Co-Admin Profiles Table */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: "#fff", fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <UserCheck size={18} color="var(--gold)" /> Active Co-Admin Team Members ({coAdmins.length})
          </h3>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Real-time helper activity & verification stats
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>Loading co-admins…</div>
        ) : coAdmins.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
            <UserCheck size={40} color="var(--text-muted)" style={{ margin: "0 auto 10px" }} />
            <h4 style={{ color: "#fff", margin: "0 0 6px" }}>No Co-Admins Joined Yet</h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 460, margin: "0 auto 16px" }}>
              Share your joining code <strong>{config?.coAdminCode || "COADMIN2026"}</strong> with volunteer teammates. When they log in, their name, WhatsApp number, and verified ticket counts will appear here.
            </p>
            <button className="btn btn-outline" onClick={copyCode} style={{ margin: "0 auto" }}>
              <Copy size={15} /> Copy Joining Code: {config?.coAdminCode || "COADMIN2026"}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="bt-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Co-Admin Name</th>
                  <th>Login ID</th>
                  <th>WhatsApp Phone</th>
                  <th>College / Unit</th>
                  <th>Tickets Confirmed</th>
                  <th>Joined Date</th>
                  <th>Actions (Delete)</th>
                </tr>
              </thead>
              <tbody>
                {coAdmins.map((admin, idx) => {
                  const confirmedCount = getConfirmedCount(admin.name);
                  return (
                    <tr key={admin.id || idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: "#fff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ background: "rgba(255,51,68,0.2)", color: "var(--gold)", padding: "2px 6px", borderRadius: 4, fontSize: "0.72rem" }}>
                            CO-ADMIN
                          </span>
                          {admin.name}
                        </div>
                      </td>
                      <td>
                        <code style={{ color: "var(--gold)", background: "rgba(255,215,0,0.1)", padding: "2px 6px", borderRadius: 4, fontSize: "0.82rem", fontWeight: 700 }}>
                          {admin.loginId || admin.phone}
                        </code>
                      </td>
                      <td>
                        <a
                          href={`https://wa.me/91${String(admin.phone || "").replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#25D366", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                        >
                          <MessageCircle size={14} /> +91 {admin.phone}
                        </a>
                      </td>
                      <td>{admin.college || "Telugu Movie Time"}</td>
                      <td>
                        <span style={{ background: "rgba(0,230,118,0.15)", color: "var(--green)", padding: "3px 8px", borderRadius: 6, fontWeight: 800, fontSize: "0.82rem" }}>
                          ✓ {confirmedCount} tickets
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {admin.joinedAt ? new Date(admin.joinedAt).toLocaleDateString("en-IN") : "Active"}
                      </td>
                      <td>
                        <button
                          className="btn btn-red"
                          style={{ padding: "6px 12px", fontSize: "0.78rem", gap: 5 }}
                          onClick={() => handleDeleteCoAdmin(admin)}
                          title="Remove Co-Admin Access"
                        >
                          <Trash2 size={14} /> Delete & Revoke Access
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
