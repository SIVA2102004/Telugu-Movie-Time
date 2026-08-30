import { useState, useRef, useCallback } from "react";
import { db, storage } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { buildDefaultLayout } from "../hooks/useMovieConfig";
import { Save, Upload, Plus, Minus, Trash2, ChevronUp, ChevronDown, Image, Info, ArrowDownUp, Tag, IndianRupee } from "lucide-react";
import toast from "react-hot-toast";
import "./TheaterLayoutEditor.css";

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ROWS = 26;
const MAX_COLS = 30;

const DEFAULT_TIERS = ["Platinum", "Gold", "Silver"];

export default function TheaterLayoutEditor({ config }) {
  // ── Layout state ─────────────────────────────────────────────────────────
  const [layout, setLayout] = useState(() => {
    if (config.layout && config.layout.rows && config.layout.seats) {
      const cloned = JSON.parse(JSON.stringify(config.layout));
      if (!cloned.rowTiers) cloned.rowTiers = {};
      if (!cloned.tierPrices) {
        cloned.tierPrices = { Platinum: 300, Gold: 250, Silver: 200 };
      }
      return cloned;
    }
    return buildDefaultLayout(8, 10);
  });

  // ── Blueprint image state ─────────────────────────────────────────────────
  const [blueprintUrl, setBlueprintUrl]         = useState(config.blueprintImageUrl || null);
  const [blueprintPreview, setBlueprintPreview] = useState(config.blueprintImageUrl || null);
  const [uploading, setUploading]               = useState(false);
  const fileInputRef = useRef(null);

  // ── Saving state ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // ════════════════════════════════════════════════════════════════
  // TIER & PRICING MANAGEMENT
  // ════════════════════════════════════════════════════════════════

  const setRowTier = (rowLabel, tier) => {
    setLayout((prev) => ({
      ...prev,
      rowTiers: {
        ...(prev.rowTiers || {}),
        [rowLabel]: tier,
      },
    }));
  };

  const setTierPrice = (tier, price) => {
    const num = Math.max(0, parseInt(price) || 0);
    setLayout((prev) => ({
      ...prev,
      tierPrices: {
        ...(prev.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 }),
        [tier]: num,
      },
    }));
  };

  // Bulk set multiple rows to a tier (e.g. B through I to Gold)
  const setTierRange = (tier, startRow, endRow) => {
    const startIdx = layout.rows.indexOf(startRow);
    const endIdx = layout.rows.indexOf(endRow);
    if (startIdx === -1 || endIdx === -1) return;
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

    setLayout((prev) => {
      const updated = { ...(prev.rowTiers || {}) };
      for (let i = from; i <= to; i++) {
        updated[prev.rows[i]] = tier;
      }
      return { ...prev, rowTiers: updated };
    });
    toast.success(`Rows ${startRow} to ${endRow} set to ${tier}`);
  };

  // ════════════════════════════════════════════════════════════════
  // LAYOUT MANIPULATION HELPERS
  // ════════════════════════════════════════════════════════════════

  const addRow = () => {
    setLayout((prev) => {
      if (prev.rows.length >= MAX_ROWS) { toast.error("Maximum 26 rows reached."); return prev; }
      const nextLabel = ROW_LABELS[prev.rows.length];
      const defaultSeats = Array.from({ length: 10 }, (_, i) => i + 1);
      return {
        ...prev,
        rows: [...prev.rows, nextLabel],
        seats: { ...prev.seats, [nextLabel]: defaultSeats },
        rowTiers: { ...(prev.rowTiers || {}), [nextLabel]: "Silver" },
      };
    });
  };

  const removeLastRow = () => {
    setLayout((prev) => {
      if (prev.rows.length <= 1) { toast.error("At least one row required."); return prev; }
      const rows = prev.rows.slice(0, -1);
      const removed = prev.rows[prev.rows.length - 1];
      const seats = { ...prev.seats };
      const rowTiers = { ...(prev.rowTiers || {}) };
      delete seats[removed];
      delete rowTiers[removed];
      return { ...prev, rows, seats, rowTiers };
    });
  };

  const moveRowUp = (idx) => {
    if (idx === 0) return;
    setLayout((prev) => {
      const rows = [...prev.rows];
      [rows[idx - 1], rows[idx]] = [rows[idx], rows[idx - 1]];
      return { ...prev, rows };
    });
  };

  const moveRowDown = (idx) => {
    if (idx >= prev.rows.length - 1) return prev;
    setLayout((prev) => {
      const rows = [...prev.rows];
      [rows[idx], rows[idx + 1]] = [rows[idx + 1], rows[idx]];
      return { ...prev, rows };
    });
  };

  const renameRow = (oldLabel, newLabel) => {
    newLabel = newLabel.toUpperCase().trim();
    if (!newLabel || newLabel.length > 2) return;
    setLayout((prev) => {
      if (prev.rows.includes(newLabel) && newLabel !== oldLabel) {
        toast.error(`Row "${newLabel}" already exists.`); return prev;
      }
      const rows = prev.rows.map((r) => (r === oldLabel ? newLabel : r));
      const seats = {};
      const rowTiers = {};
      Object.entries(prev.seats).forEach(([k, v]) => {
        seats[k === oldLabel ? newLabel : k] = v;
      });
      Object.entries(prev.rowTiers || {}).forEach(([k, v]) => {
        rowTiers[k === oldLabel ? newLabel : k] = v;
      });
      return { ...prev, rows, seats, rowTiers };
    });
  };

  const setRowSeatCount = (rowLabel, count) => {
    count = Math.max(1, Math.min(MAX_COLS, parseInt(count) || 1));
    setLayout((prev) => {
      const current = prev.seats[rowLabel] || [];
      const seatSlots = current.filter((s) => s !== null);
      let newRow;
      if (count > seatSlots.length) {
        const next = seatSlots.length + 1;
        const toAdd = Array.from({ length: count - seatSlots.length }, (_, i) => next + i);
        newRow = [...current, ...toAdd];
      } else {
        let removed = 0;
        const needed = seatSlots.length - count;
        newRow = [...current].reverse().filter((s) => {
          if (s !== null && removed < needed) { removed++; return false; }
          return true;
        }).reverse();
      }
      return { ...prev, seats: { ...prev.seats, [rowLabel]: newRow } };
    });
  };

  const toggleSlot = (rowLabel, slotIdx) => {
    setLayout((prev) => {
      const row = [...(prev.seats[rowLabel] || [])];
      if (row[slotIdx] === null) {
        const maxNum = row.filter((s) => s !== null).reduce((m, s) => Math.max(m, s), 0);
        row[slotIdx] = maxNum + 1;
        let n = 0;
        const renumbered = row.map((s) => (s === null ? null : ++n));
        return { ...prev, seats: { ...prev.seats, [rowLabel]: renumbered } };
      } else {
        row[slotIdx] = null;
        let n = 0;
        const renumbered = row.map((s) => (s === null ? null : ++n));
        return { ...prev, seats: { ...prev.seats, [rowLabel]: renumbered } };
      }
    });
  };

  const insertGapAfter = (rowLabel, slotIdx) => {
    setLayout((prev) => {
      const row = [...(prev.seats[rowLabel] || [])];
      row.splice(slotIdx + 1, 0, null);
      return { ...prev, seats: { ...prev.seats, [rowLabel]: row } };
    });
  };

  const clearGaps = (rowLabel) => {
    setLayout((prev) => {
      const row = (prev.seats[rowLabel] || []).filter((s) => s !== null);
      const renumbered = row.map((_, i) => i + 1);
      return { ...prev, seats: { ...prev.seats, [rowLabel]: renumbered } };
    });
  };

  const reverseRowOrder = () => {
    setLayout((prev) => {
      const rows = [...prev.rows].reverse();
      return { ...prev, rows };
    });
    toast.success("Row order reversed!");
  };

  const toggleScreenPosition = () => {
    setLayout((prev) => {
      const nextPos = prev.screenPosition === "bottom" ? "top" : "bottom";
      return { ...prev, screenPosition: nextPos };
    });
  };

  // ════════════════════════════════════════════════════════════════
  // BLUEPRINT UPLOAD & COMPRESSION
  // ════════════════════════════════════════════════════════════════

  const compressImage = (file, maxWidth = 1200, quality = 0.75) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.src = url;
    });
  };

  const handleBlueprintFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file."); return; }

    const localUrl = URL.createObjectURL(file);
    setBlueprintPreview(localUrl);

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const sizeMB = (compressed.size / 1024 / 1024).toFixed(2);
      toast(`Compressed to ${sizeMB} MB, uploading…`, { icon: "📦" });

      const path = `blueprints/${Date.now()}.jpg`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, compressed, { contentType: "image/jpeg" });
      const downloadUrl = await getDownloadURL(sRef);
      setBlueprintUrl(downloadUrl);
      toast.success("Blueprint uploaded!");
    } catch (err) {
      console.error(err);
      toast("Blueprint saved in browser session.", { icon: "ℹ️" });
      setBlueprintUrl(null);
    }
    setUploading(false);
  };

  const onFileChange = (e) => handleBlueprintFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    handleBlueprintFile(e.dataTransfer.files[0]);
  };

  // ════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════════

  const BLUEPRINT_LAYOUT = {
    rows: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O"],
    screenPosition: "top",
    rowTiers: {
      A: "Platinum",
      B: "Gold",
      C: "Gold",
      D: "Gold",
      E: "Gold",
      F: "Gold",
      G: "Gold",
      H: "Gold",
      I: "Gold",
      J: "Silver",
      K: "Silver",
      L: "Silver",
      M: "Silver",
      N: "Silver",
      O: "Silver",
    },
    tierPrices: {
      Platinum: 300,
      Gold: 250,
      Silver: 200,
    },
    seats: {
      A: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
      B: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      C: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      D: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      E: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      F: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      G: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      H: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      I: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,null,17,18,19,20],
      J: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      K: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      L: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      M: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      N: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
      O: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
    },
  };

  const TEMPLATES = [
    {
      name: "⭐ Your Theater (Recliner, Gold, Silver)",
      highlight: true,
      build: () => JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT)),
    },
    {
      name: "Default 10×10",
      build: () => buildDefaultLayout(10, 10),
    },
    {
      name: "PVR Style (8 rows, centre aisle)",
      build: () => {
        const rows = "ABCDEFGH".split("");
        const seats = {};
        rows.forEach((r) => {
          seats[r] = [1,2,3,4,5,null,6,7,8,9,10];
        });
        return {
          rows,
          seats,
          rowTiers: { A: "Platinum", B: "Gold", C: "Gold", D: "Gold", E: "Silver", F: "Silver", G: "Silver", H: "Silver" },
          tierPrices: { Platinum: 300, Gold: 250, Silver: 200 },
        };
      },
    },
  ];

  const applyTemplate = (tmpl) => {
    if (tmpl.highlight) {
      setLayout(tmpl.build());
      toast.success("Blueprint layout with Platinum/Gold/Silver tiers applied! ✅");
    } else {
      if (window.confirm(`Apply template "${tmpl.name}"?`)) {
        setLayout(tmpl.build());
        toast.success(`Template "${tmpl.name}" applied.`);
      }
    }
  };

  // ════════════════════════════════════════════════════════════════
  // FAST SAVE (with local caching)
  // ════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    setSaving(true);
    const updatedData = {
      ...config,
      layout,
      blueprintImageUrl: blueprintUrl || null,
    };

    // Instant local save
    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updatedData));
    } catch (e) {}

    // Cloud firestore save
    try {
      await setDoc(doc(db, "movieConfig", "current"), updatedData, { merge: true });
      toast.success("Layout & Tier Prices Saved Instantly! 🚀");
    } catch (err) {
      console.warn("Firestore sync error:", err);
      toast.success("Saved to local workspace cache! ✅");
    }
    setSaving(false);
  };

  const totalSeats = layout.rows.reduce((sum, r) => {
    return sum + (layout.seats[r] || []).filter((s) => s !== null).length;
  }, 0);

  const tierPrices = layout.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  return (
    <div className="tle-wrapper">

      {/* ── Top bar ── */}
      <div className="tle-topbar">
        <div>
          <h2 className="tle-title">Theater Layout & Category Pricing</h2>
          <p className="tle-subtitle">
            {layout.rows.length} rows · {totalSeats} seats · Configurable Silver / Gold / Platinum rates
          </p>
        </div>
        <div className="tle-topbar-actions">
          <button className="btn btn-ghost" onClick={() => setShowHelp((v) => !v)}>
            <Info size={15} /> Help
          </button>
          <button className="btn btn-gold" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</>
              : <><Save size={15} /> Save Layout & Prices</>
            }
          </button>
        </div>
      </div>

      {/* ── Help panel ── */}
      {showHelp && (
        <div className="tle-help card">
          <strong>How to use Tier Pricing & Layout:</strong>
          <ul>
            <li>🏷️ <strong>Category Pricing:</strong> Set price for Platinum, Gold, and Silver in the left panel.</li>
            <li>💺 <strong>Row Tier:</strong> Select Platinum/Gold/Silver next to each row in the grid.</li>
            <li>🟢 <strong>Seats:</strong> Click any green seat to toggle into gap/aisle.</li>
            <li>🔄 <strong>Screen Position:</strong> Switch between TOP and BOTTOM screen orientation.</li>
          </ul>
        </div>
      )}

      <div className="tle-main">

        {/* ══════════════════════════════════
            LEFT: Prices, Blueprint & Templates
        ══════════════════════════════════ */}
        <div className="tle-left">

          {/* Tier Prices Card */}
          <div className="tle-section card tle-tier-editor">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
              <h3 className="tle-section-title" style={{ margin: 0 }}><IndianRupee size={15} /> Category Rates (₹)</h3>
            </div>

            {/* Toggle Keep or Remove Category Rates */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, width: "100%" }}>
              <button
                type="button"
                className={`btn ${layout.enableCategoryPricing !== false ? "btn-gold" : "btn-ghost"}`}
                style={{ flex: 1, padding: "5px 4px", fontSize: "0.72rem", fontWeight: 700 }}
                onClick={() => {
                  setLayout((prev) => ({ ...prev, enableCategoryPricing: true }));
                  toast.success("Category Rates ENABLED! Multi-tier pricing active.");
                }}
              >
                ✓ Keep
              </button>
              <button
                type="button"
                className={`btn ${layout.enableCategoryPricing === false ? "btn-red" : "btn-ghost"}`}
                style={{ flex: 1, padding: "5px 4px", fontSize: "0.72rem", fontWeight: 700 }}
                onClick={() => {
                  setLayout((prev) => ({ ...prev, enableCategoryPricing: false }));
                  toast.success("Category Rates REMOVED! Single flat rate active.");
                }}
              >
                ✕ Remove
              </button>
            </div>

            {layout.enableCategoryPricing !== false ? (
              <div className="tle-tier-inputs">
                {DEFAULT_TIERS.map((tier) => (
                  <div key={tier} className="tle-tier-row">
                    <span className={`tle-tier-badge tle-tier-badge--${tier.toLowerCase()}`}>
                      {tier}
                    </span>
                    <div className="tle-price-input-wrap">
                      <span>₹</span>
                      <input
                        type="number"
                        className="input tle-price-input"
                        value={tierPrices[tier] || 0}
                        onChange={(e) => setTierPrice(tier, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "rgba(255, 68, 68, 0.1)", border: "1px dashed var(--red)", borderRadius: 6, padding: "8px 10px", fontSize: "0.75rem", color: "#ff4444", fontWeight: 700, textAlign: "center" }}>
                🚫 Categories Removed. All seats will use the Base Price.
              </div>
            )}
          </div>

          {/* Blueprint upload */}
          <div className="tle-section card">
            <h3 className="tle-section-title"><Image size={15} /> Blueprint Reference</h3>
            <div
              className={`tle-dropzone ${uploading ? "tle-dropzone--uploading" : ""}`}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {blueprintPreview ? (
                <img src={blueprintPreview} alt="Blueprint" className="tle-blueprint-img" />
              ) : (
                <div className="tle-dropzone-placeholder">
                  <Upload size={28} color="var(--text-muted)" />
                  <p>Drop image here<br />or click to upload</p>
                  <small>Auto-compressed for fast upload</small>
                </div>
              )}
              {uploading && (
                <div className="tle-dropzone-overlay">
                  <span className="spinner" />
                  <span>Compressing & Uploading…</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
            {blueprintPreview && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: "0.78rem", padding: "4px 10px", marginTop: 6 }}
                onClick={() => { setBlueprintPreview(null); setBlueprintUrl(null); }}
              >
                <Trash2 size={13} /> Remove image
              </button>
            )}
          </div>

          {/* Templates */}
          <div className="tle-section card">
            <h3 className="tle-section-title">Templates</h3>
            <div className="tle-templates">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  className={`btn tle-template-btn ${t.highlight ? "tle-template-btn--highlight" : "btn-ghost"}`}
                  onClick={() => applyTemplate(t)}
                >
                  {t.name}
                  {t.highlight && <span className="tle-template-badge">15 rows · 274 seats</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            RIGHT: Visual Grid Editor
        ══════════════════════════════════ */}
        <div className="tle-right">
          <div className="card tle-editor-card">

            {/* Screen position controls & Screen indicator */}
            <div className="tle-grid-header">
              <div className="tle-grid-tools">
                <button
                  type="button"
                  className={`btn ${layout.screenPosition === "bottom" ? "btn-outline" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  onClick={toggleScreenPosition}
                  title="Switch screen position between Top and Bottom"
                >
                  Screen: <strong>{layout.screenPosition === "bottom" ? "BOTTOM" : "TOP"}</strong>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  onClick={reverseRowOrder}
                  title="Swap / reverse seating order from front to back"
                >
                  <ArrowDownUp size={13} /> Swap Row Order
                </button>
              </div>

              {layout.screenPosition !== "bottom" && (
                <div className="tle-screen-bar">
                  <div className="tle-screen-line" />
                  <span>SCREEN (FRONT)</span>
                  <div className="tle-screen-line" />
                </div>
              )}
            </div>

            {/* Row list */}
            <div className="tle-rows">
              {layout.rows.map((rowLabel, rowIdx) => {
                const rowSlots = layout.seats[rowLabel] || [];
                const seatCount = rowSlots.filter((s) => s !== null).length;
                const currentTier = layout.rowTiers?.[rowLabel] || "Silver";

                return (
                  <div key={rowLabel} className="tle-row">
                    {/* Row controls (left) */}
                    <div className="tle-row-controls">
                      <input
                        className="tle-row-label-input"
                        value={rowLabel}
                        maxLength={2}
                        onChange={(e) => renameRow(rowLabel, e.target.value)}
                        title="Click to rename this row"
                      />
                      {/* Tier dropdown per row */}
                      <select
                        className={`tle-tier-select tle-tier-select--${currentTier.toLowerCase()}`}
                        value={currentTier}
                        onChange={(e) => setRowTier(rowLabel, e.target.value)}
                        title={`Select tier for Row ${rowLabel}`}
                      >
                        {DEFAULT_TIERS.map((t) => (
                          <option key={t} value={t}>{t} (₹{tierPrices[t] || 0})</option>
                        ))}
                      </select>

                      <div className="tle-row-arrows">
                        <button
                          className="tle-arrow-btn"
                          onClick={() => moveRowUp(rowIdx)}
                          disabled={rowIdx === 0}
                          title="Move row up"
                        ><ChevronUp size={12} /></button>
                        <button
                          className="tle-arrow-btn"
                          onClick={() => moveRowDown(rowIdx)}
                          disabled={rowIdx === layout.rows.length - 1}
                          title="Move row down"
                        ><ChevronDown size={12} /></button>
                      </div>
                    </div>

                    {/* Seat slots */}
                    <div className="tle-seat-row">
                      {rowSlots.map((slot, slotIdx) => (
                        <div key={slotIdx} className="tle-slot-group">
                          <button
                            className={`tle-seat-btn ${slot === null ? "tle-seat-btn--gap" : "tle-seat-btn--seat"} tle-seat-btn--tier-${currentTier.toLowerCase()}`}
                            onClick={() => toggleSlot(rowLabel, slotIdx)}
                            title={slot === null ? "Gap — click to restore as seat" : `Seat ${rowLabel}${slot} (${currentTier} - ₹${tierPrices[currentTier]})`}
                          >
                            {slot !== null ? slot : "·"}
                          </button>
                          <button
                            className="tle-insert-gap"
                            onClick={() => insertGapAfter(rowLabel, slotIdx)}
                            title="Insert aisle gap here"
                          >|</button>
                        </div>
                      ))}
                    </div>

                    {/* Seat count input (right) */}
                    <div className="tle-row-meta">
                      <div className="tle-count-control">
                        <button
                          className="tle-count-btn"
                          onClick={() => setRowSeatCount(rowLabel, seatCount - 1)}
                        ><Minus size={10} /></button>
                        <input
                          className="tle-count-input"
                          type="number"
                          min={1}
                          max={MAX_COLS}
                          value={seatCount}
                          onChange={(e) => setRowSeatCount(rowLabel, e.target.value)}
                          title="Number of seats in this row"
                        />
                        <button
                          className="tle-count-btn"
                          onClick={() => setRowSeatCount(rowLabel, seatCount + 1)}
                        ><Plus size={10} /></button>
                      </div>
                      <button
                        className="tle-clear-gaps-btn"
                        onClick={() => clearGaps(rowLabel)}
                        title="Remove all gaps from this row"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add/Remove row buttons */}
            <div className="tle-row-actions">
              <button className="btn btn-ghost" onClick={removeLastRow} disabled={layout.rows.length <= 1}>
                <Minus size={14} /> Remove Last Row
              </button>
              <span className="tle-total-badge">{totalSeats} seats</span>
              <button className="btn btn-outline" onClick={addRow} disabled={layout.rows.length >= MAX_ROWS}>
                <Plus size={14} /> Add Row
              </button>
            </div>

            {layout.screenPosition === "bottom" && (
              <div className="tle-screen-bar" style={{ marginTop: 20 }}>
                <div className="tle-screen-line" />
                <span>SCREEN (FRONT)</span>
                <div className="tle-screen-line" />
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="tle-legend">
            <span className="tle-legend-item"><span className="tle-dot tle-dot--seat" />Seat</span>
            <span className="tle-legend-item"><span className="tle-dot tle-dot--gap" />Gap / Aisle</span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              Click any seat to toggle · Select tier per row · Set tier prices on left
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
