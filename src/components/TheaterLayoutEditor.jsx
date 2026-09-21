import { useState, useRef, useEffect, useCallback } from "react";
import { db, storage } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { buildDefaultLayout, BLUEPRINT_LAYOUT, CURVED_AMPHITHEATER_LAYOUT, DEFAULT_SCREENS, sanitizeLayout } from "../hooks/useMovieConfig";
import { Save, Upload, Plus, Minus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Info, ArrowDownUp, Tag, IndianRupee, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import "./TheaterLayoutEditor.css";

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ROWS = 26;
const MAX_COLS = 30;

const DEFAULT_TIERS = ["Platinum", "Gold", "Silver"];

export function computeRowSeats(rowSlots, isRTL, isFixed) {
  if (!Array.isArray(rowSlots)) return [];
  const totalCols = rowSlots.length;
  const activeSlots = rowSlots.filter((s) => s !== null).length;
  const numsInRow = rowSlots.filter((s) => typeof s === "number");
  const maxRowSeatNum = numsInRow.length > 0 ? Math.max(...numsInRow) : activeSlots;
  let seqNum = 0;
  return rowSlots.map((slot, idx) => {
    if (slot === null) return null;
    seqNum++;
    if (typeof slot === "number") {
      return isRTL ? (maxRowSeatNum - slot + 1) : slot;
    }
    return isFixed
      ? (isRTL ? (totalCols - idx) : (idx + 1))
      : (isRTL ? (activeSlots - seqNum + 1) : seqNum);
  });
}

export function recalculateAllSeats(seats, isRTL, isFixed) {
  const newSeats = {};
  Object.keys(seats || {}).forEach((r) => {
    newSeats[r] = computeRowSeats(seats[r], isRTL, isFixed);
  });
  return newSeats;
}

export default function TheaterLayoutEditor({ config, selectedScreenId: initialScreenId }) {
  const screens = config?.screens || DEFAULT_SCREENS;

  const [activeScreenId, setActiveScreenId] = useState(
    initialScreenId || config?.activeScreenId || "screen-1"
  );

  const currentScreenObj = screens.find((s) => s.id === activeScreenId) || screens[0];

  // ── Layout state ─────────────────────────────────────────────────────────
  const [layout, setLayout] = useState(() => {
    const scrLayout = currentScreenObj?.layout || config?.layout;
    if (scrLayout && scrLayout.rows && scrLayout.seats) {
      const cloned = JSON.parse(JSON.stringify(scrLayout));
      if (!cloned.rowTiers) cloned.rowTiers = {};
      if (!cloned.tierPrices) {
        cloned.tierPrices = { Platinum: 500, Gold: 320, Silver: 200 };
      }
      return sanitizeLayout(cloned);
    }
    return JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT));
  });

  const isSavingRef = useRef(false);
  const lastSavedLayoutStrRef = useRef("");

  // Automatically keep layout state in sync when activeScreenId changes
  useEffect(() => {
    isSavingRef.current = false;
    const targetScr = screens.find((s) => s.id === activeScreenId) || screens[0];
    const targetLayout = targetScr?.layout || (activeScreenId === "screen-1" ? config?.layout : null) || (activeScreenId === "screen-3" ? CURVED_AMPHITHEATER_LAYOUT : BLUEPRINT_LAYOUT);
    const cloned = JSON.parse(JSON.stringify(targetLayout));
    if (!cloned.rowTiers) cloned.rowTiers = {};
    if (!cloned.tierPrices) {
      cloned.tierPrices = targetScr?.tierPrices || { Platinum: 500, Gold: 320, Silver: 200 };
    }
    const clean = sanitizeLayout(cloned);
    setLayout(clean);

    const scrBlueprint = targetScr?.blueprintImageUrl || (activeScreenId === "screen-1" ? config?.blueprintImageUrl : null) || null;
    setBlueprintUrl(scrBlueprint);
    setBlueprintPreview(scrBlueprint);
  }, [activeScreenId]);

  // Switch screen in layout editor
  const handleSelectScreen = (screenId) => {
    setActiveScreenId(screenId);
    isSavingRef.current = false;
    lastSavedLayoutStrRef.current = "";
    const targetScr = screens.find((s) => s.id === screenId) || screens[0];
    const scrLayout = targetScr?.layout || (screenId === "screen-1" ? config?.layout : null) || BLUEPRINT_LAYOUT;
    const cloned = JSON.parse(JSON.stringify(scrLayout));
    if (!cloned.rowTiers) cloned.rowTiers = {};
    if (!cloned.tierPrices) {
      cloned.tierPrices = targetScr?.tierPrices || { Platinum: 500, Gold: 320, Silver: 200 };
    }
    setLayout(sanitizeLayout(cloned));

    // Isolate blueprint image per screen
    const scrBlueprint = targetScr?.blueprintImageUrl || (screenId === "screen-1" ? config?.blueprintImageUrl : null) || null;
    setBlueprintUrl(scrBlueprint);
    setBlueprintPreview(scrBlueprint);

    toast.success(`Loaded layout editor for ${targetScr.name}`);
  };

  // ── Blueprint image state (strictly isolated per screen) ────────────────────
  const initialBlueprint = currentScreenObj?.blueprintImageUrl || (activeScreenId === "screen-1" ? config?.blueprintImageUrl : null) || null;
  const [blueprintUrl, setBlueprintUrl]         = useState(initialBlueprint);
  const [blueprintPreview, setBlueprintPreview] = useState(initialBlueprint);
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
    setLayout((prev) => {
      if (idx >= prev.rows.length - 1) return prev;
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
        const toAdd = Array.from({ length: count - seatSlots.length }, () => 1);
        newRow = [...current, ...toAdd];
      } else {
        let removed = 0;
        const needed = seatSlots.length - count;
        newRow = [...current].reverse().filter((s) => {
          if (s !== null && removed < needed) { removed++; return false; }
          return true;
        }).reverse();
      }
      const isFixed = prev.numberingMode === "fixed";
      const isRTL = prev.seatDirection === "rtl";
      const recalculatedRow = computeRowSeats(newRow, isRTL, isFixed);
      return { ...prev, seats: { ...prev.seats, [rowLabel]: recalculatedRow } };
    });
  };

  const toggleSeatDirection = () => {
    setLayout((prev) => {
      const nextDir = prev.seatDirection === "rtl" ? "ltr" : "rtl";
      const isRTL = nextDir === "rtl";
      const isFixed = prev.numberingMode === "fixed";
      const seats = recalculateAllSeats(prev.seats, isRTL, isFixed);

      toast.success(`Seat numbers set to ${nextDir === "rtl" ? "Right-to-Left (N ➔ 1)" : "Left-to-Right (1 ➔ N)"}! ↔️`);
      return { ...prev, seatDirection: nextDir, seats };
    });
  };

  const toggleNumberingMode = () => {
    setLayout((prev) => {
      const nextMode = prev.numberingMode === "sequential" ? "fixed" : "sequential";
      const isRTL = prev.seatDirection === "rtl";
      const isFixed = nextMode === "fixed";
      const seats = recalculateAllSeats(prev.seats, isRTL, isFixed);

      toast.success(`Numbering mode set to ${nextMode === "fixed" ? "Fixed Column (numbers don't shift when blocked)" : "Sequential"}! 🔢`);
      return { ...prev, numberingMode: nextMode, seats };
    });
  };

  const toggleSlot = (rowLabel, slotIdx) => {
    setLayout((prev) => {
      const row = [...(prev.seats[rowLabel] || [])];
      
      if (row[slotIdx] === null) {
        let restored = slotIdx + 1;
        for (let i = slotIdx - 1; i >= 0; i--) {
          if (typeof row[i] === "number") {
            restored = row[i] + 1;
            break;
          }
        }
        row[slotIdx] = restored;
      } else {
        row[slotIdx] = null;
      }

      return { ...prev, seats: { ...prev.seats, [rowLabel]: row } };
    });
  };

  const insertGapAfter = (rowLabel, slotIdx) => {
    setLayout((prev) => {
      const row = [...(prev.seats[rowLabel] || [])];
      row.splice(slotIdx + 1, 0, null);
      const isFixed = prev.numberingMode === "fixed";
      const isRTL = prev.seatDirection === "rtl";
      const recalculatedRow = computeRowSeats(row, isRTL, isFixed);
      return { ...prev, seats: { ...prev.seats, [rowLabel]: recalculatedRow } };
    });
  };

  const clearGaps = (rowLabel) => {
    setLayout((prev) => {
      const isFixed = prev.numberingMode === "fixed";
      const isRTL = prev.seatDirection === "rtl";
      const row = (prev.seats[rowLabel] || []).filter((s) => s !== null);
      const recalculatedRow = computeRowSeats(row, isRTL, isFixed);
      return { ...prev, seats: { ...prev.seats, [rowLabel]: recalculatedRow } };
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
  // BLUEPRINT UPLOAD & COMPRESSION (High Res, Fast, No Freeze)
  // ════════════════════════════════════════════════════════════════

  const compressImage = (file, maxWidth = 2560, quality = 0.90) => {
    return new Promise((resolve) => {
      // If file is already small (< 1.5MB), keep original to preserve full resolution
      if (file.size < 1.5 * 1024 * 1024) {
        return resolve(file);
      }
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => resolve(blob || file),
          file.type === "image/png" ? "image/png" : "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
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
      toast(`Processing high-res blueprint (${sizeMB} MB)…`, { icon: "📦" });

      // Convert to base64 for instant local display & instant layout reference
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setBlueprintPreview(reader.result);
          setBlueprintUrl(reader.result);
        }
      };
      reader.readAsDataURL(compressed);

      // Upload to Firebase storage with timeout protection
      const path = `blueprints/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const sRef = storageRef(storage, path);
      
      const uploadPromise = uploadBytes(sRef, compressed, { contentType: compressed.type || "image/jpeg" });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout")), 8000));
      
      await Promise.race([uploadPromise, timeoutPromise]);
      const downloadUrl = await getDownloadURL(sRef);
      setBlueprintUrl(downloadUrl);
      setBlueprintPreview(downloadUrl);
      // Automatically auto-apply the layout matching this screen's uploaded blueprint
      const targetLayout = activeScreenId === "screen-3" ? CURVED_AMPHITHEATER_LAYOUT : BLUEPRINT_LAYOUT;
      setLayout(JSON.parse(JSON.stringify(targetLayout)));
      const infoMsg = activeScreenId === "screen-3"
        ? "Seating order automatically updated from blueprint! (8 Curved Rows · 152 Seats) 🎯"
        : "Seating order automatically updated from blueprint! (14 Rows · Row A Recliner 1-18, Rows B-N Gold 20 Seats · 278 Seats) 🎯";
      toast.success(infoMsg, { duration: 5000 });
    } catch (err) {
      console.warn("Cloud storage upload notice:", err);
      // Even if cloud storage is slow or times out, localUrl/base64 is preserved in editor
      const targetLayout = activeScreenId === "screen-3" ? CURVED_AMPHITHEATER_LAYOUT : BLUEPRINT_LAYOUT;
      setLayout(JSON.parse(JSON.stringify(targetLayout)));
      toast.success("Seating order updated to match blueprint layout! 🎯");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e) => handleBlueprintFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    handleBlueprintFile(e.dataTransfer.files[0]);
  };

  // ════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════════


  const TEMPLATES = [
    {
      name: "⭐ Hall Blueprint (Recliner A1-A18, Gold B-N 20 Seats · 278 Seats)",
      highlight: true,
      build: () => JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT)),
    },
    {
      name: "🏛️ Amphitheater / Curved Fan (8 Rows · 152 Seats)",
      highlight: true,
      build: () => JSON.parse(JSON.stringify(CURVED_AMPHITHEATER_LAYOUT)),
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
      toast.success("Blueprint layout (278 seats · Row A Recliner 1-18, Rows B-N Gold 20 Seats) applied! ✅");
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
    isSavingRef.current = true;
    setSaving(true);
    lastSavedLayoutStrRef.current = JSON.stringify(layout);

    // Save layout into the specific active screen in screens array
    const updatedScreens = screens.map((s) => {
      if (s.id === activeScreenId) {
        return {
          ...s,
          layout,
          tierPrices: layout.tierPrices,
          blueprintImageUrl: blueprintUrl || null,
        };
      }
      return s;
    });

    const updatedData = {
      ...config,
      screens: updatedScreens,
      layout: activeScreenId === (config?.activeScreenId || "screen-1") ? layout : config?.layout,
      blueprintImageUrl: activeScreenId === "screen-1" ? (blueprintUrl || null) : (config?.blueprintImageUrl || null),
    };

    const targetDocId = config?.id || config?.theaterId || sessionStorage.getItem("adminTheaterId") || "current";

    // Instant local save per theater + global
    try {
      localStorage.setItem(`telugu_talkies_movie_config_${targetDocId}`, JSON.stringify(updatedData));
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updatedData));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    // Cloud firestore save to movieConfig/[targetDocId], movieConfig/current AND theaters/[targetDocId]
    try {
      await setDoc(doc(db, "movieConfig", targetDocId), updatedData, { merge: true });
      await setDoc(doc(db, "movieConfig", "current"), updatedData, { merge: true });

      if (targetDocId && targetDocId !== "current") {
        await setDoc(
          doc(db, "theaters", targetDocId),
          {
            screens: updatedScreens,
            activeScreenId: config?.activeScreenId || "screen-1",
            layout: updatedData.layout,
          },
          { merge: true }
        );
      }

      toast.success(`Layout for ${currentScreenObj.name} Saved Instantly! 🚀`);
    } catch (err) {
      console.warn("Firestore sync error:", err);
      toast.success("Saved to local workspace cache! ✅");
    }
    setSaving(false);
    setTimeout(() => {
      isSavingRef.current = false;
    }, 1500);
  };

  const totalSeats = layout.rows.reduce((sum, r) => {
    return sum + (layout.seats[r] || []).filter((s) => s !== null).length;
  }, 0);

  const tierPrices = layout.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  return (
    <div className="tle-wrapper">

      {/* ── Screen Switcher Tabs ── */}
      <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid var(--gold)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.88rem", color: "var(--gold)", fontWeight: 800 }}>
            🖥️ Select Screen to Edit Layout:
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            (Each screen can have a completely unique seating structure)
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {screens.map((scr) => {
            const isCurrent = scr.id === activeScreenId;
            return (
              <button
                key={scr.id}
                type="button"
                className={`btn ${isCurrent ? "btn-gold" : "btn-ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem", fontWeight: 700 }}
                onClick={() => handleSelectScreen(scr.id)}
              >
                {scr.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Top bar ── */}
      <div className="tle-topbar">
        <div>
          <h2 className="tle-title">
            Seating Layout: <span style={{ color: "var(--gold)" }}>{currentScreenObj.name}</span>
          </h2>
          <p className="tle-subtitle">
            {layout.rows.length} rows · {totalSeats} seats · Auto-adjusts to Hall Blueprint
          </p>
        </div>
        <div className="tle-topbar-actions">
          {activeScreenId === "screen-3" ? (
            <button
              type="button"
              className="btn btn-gold"
              style={{ fontWeight: 800, boxShadow: "0 0 12px rgba(255, 215, 0, 0.4)" }}
              onClick={() => {
                const curved = JSON.parse(JSON.stringify(CURVED_AMPHITHEATER_LAYOUT));
                setLayout(curved);
                toast.success("Applied Screen 3 Amphitheater Blueprint Layout (8 Curved Rows · 152 Seats)! 🎯");
              }}
              title="Click to instantly auto-align Screen 3 layout to the uploaded amphitheater blueprint"
            >
              🎯 Auto-Align Blueprint (8 Rows · 152 Seats)
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-gold"
              style={{ fontWeight: 800, boxShadow: "0 0 12px rgba(255, 215, 0, 0.4)" }}
              onClick={() => {
                const blueprint = JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT));
                setLayout(blueprint);
                toast.success("Applied & Auto-Aligned exact 278-seat Hall Blueprint (Row A Recliner to Row N Gold)! ✨");
              }}
              title="Click to instantly auto-align the layout to the physical 278-seat theater blueprint"
            >
              ✨ Auto-Align Blueprint (278 Seats)
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setShowHelp((v) => !v)}>
            <Info size={15} /> Help
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: "var(--green)", color: "#000", fontWeight: 800 }}>
            {saving
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</>
              : <><Save size={15} /> Save Layout</>
            }
          </button>
        </div>
      </div>

      {/* ── Help panel ── */}
      {showHelp && (
        <div className="tle-help card">
          <strong>How to use Tier Pricing & Layout:</strong>
          <ul>
            <li>✨ <strong>Auto-Align:</strong> Click "Auto-Align Blueprint" to instantly restore the 278-seat hall map (Row A Recliner 1-18, Rows B-N Gold 20 Seats).</li>
            <li>🏷️ <strong>Category Pricing:</strong> Set price for Platinum, Gold, and Silver in the Category Rates card.</li>
            <li>💺 <strong>Row Tier:</strong> Select Platinum/Gold/Silver next to each row in the grid.</li>
            <li>🟢 <strong>Seats:</strong> Click any green seat to toggle into gap/aisle.</li>
            <li>🔄 <strong>Screen Position:</strong> Switch between TOP and BOTTOM screen orientation.</li>
          </ul>
        </div>
      )}

      {/* ══════════════════════════════════
          TOP DECK: 3 Auto-Adjusting Tool Cards
      ══════════════════════════════════ */}
      <div className="tle-top-deck">

        {/* 1. Category Rates */}
        <div className="tle-section card tle-tier-editor">
          <h3 className="tle-section-title"><IndianRupee size={15} /> Category Rates (₹)</h3>
          <div className="tle-tier-inputs">
            {DEFAULT_TIERS.map((tier) => {
              const isEnabled = layout.visibleTiers ? layout.visibleTiers[tier] !== false : true;
              return (
                <div key={tier} className="tle-tier-row" style={{ opacity: isEnabled ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`tle-tier-badge tle-tier-badge--${tier.toLowerCase()}`}>
                      {tier}
                    </span>
                    <button
                      type="button"
                      className={`btn ${isEnabled ? "btn-green" : "btn-red"}`}
                      style={{ padding: "2px 6px", fontSize: "0.68rem", fontWeight: 800, borderRadius: 4 }}
                      onClick={() => {
                        setLayout((prev) => ({
                          ...prev,
                          visibleTiers: {
                            ...(prev.visibleTiers || { Platinum: true, Gold: true, Silver: true }),
                            [tier]: !isEnabled,
                          },
                        }));
                      }}
                      title={isEnabled ? `Click to hide ${tier}` : `Click to show ${tier}`}
                    >
                      {isEnabled ? "✓ Keep" : "✕ Hide"}
                    </button>
                  </div>

                  <div className="tle-price-input-wrap">
                    <span>₹</span>
                    <input
                      type="number"
                      className="input tle-price-input"
                      value={tierPrices[tier] ?? ""}
                      placeholder="e.g. 200"
                      disabled={!isEnabled}
                      onChange={(e) => setTierPrice(tier, e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Blueprint Reference Image */}
        <div className="tle-section card">
          <h3 className="tle-section-title"><ImageIcon size={15} /> Blueprint Image</h3>
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
                <Upload size={22} color="var(--text-muted)" />
                <p style={{ margin: 0, fontSize: "0.78rem" }}>Upload Photo / Sheet</p>
                <small style={{ fontSize: "0.68rem" }}>Auto-compressed</small>
              </div>
            )}
            {uploading && (
              <div className="tle-dropzone-overlay">
                <span className="spinner" />
                <span>Uploading…</span>
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
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-gold"
                style={{ fontSize: "0.75rem", padding: "4px 8px", flex: 1 }}
                onClick={() => {
                  setLayout(JSON.parse(JSON.stringify(CURVED_AMPHITHEATER_LAYOUT)));
                  toast.success("Applied 8-Row Curved Layout matching Blueprint! 🎯");
                }}
                title="Convert this blueprint into interactive seating order"
              >
                ⚡ Apply Blueprint Layout
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                onClick={() => { setBlueprintPreview(null); setBlueprintUrl(null); }}
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          )}
        </div>

        {/* 3. Templates & Presets */}
        <div className="tle-section card">
          <h3 className="tle-section-title">Layout Presets</h3>
          <div className="tle-templates">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                className={`btn tle-template-btn ${t.highlight ? "tle-template-btn--highlight" : "btn-ghost"}`}
                onClick={() => applyTemplate(t)}
                style={{ padding: "6px 10px", fontSize: "0.78rem" }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          FULL-WIDTH VISUAL GRID EDITOR
      ══════════════════════════════════ */}
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

            {/* Seat Numbering Direction Toggle (LTR vs RTL) */}
            <button
              type="button"
              className={`btn ${layout.seatDirection === "rtl" ? "btn-gold" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={toggleSeatDirection}
              title="Toggle seat numbering direction: Left-to-Right (1➔N) vs Right-to-Left (N➔1)"
            >
              ↔️ Seat Numbers: <strong>{layout.seatDirection === "rtl" ? "Right ➔ Left (N ➔ 1)" : "Left ➔ Right (1 ➔ N)"}</strong>
            </button>

            {/* Numbering Mode Toggle (Fixed Column vs Sequential) */}
            <button
              type="button"
              className={`btn ${layout.numberingMode === "sequential" ? "btn-ghost" : "btn-gold"}`}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={toggleNumberingMode}
              title="Fixed Column mode keeps original seat numbers intact so blocking a seat does NOT shift other seat numbers"
            >
              🔢 Mode: <strong>{layout.numberingMode === "sequential" ? "Sequential" : "Fixed Column (No Shift)"}</strong>
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
                      {(() => {
                        const isRTL = layout.seatDirection === "rtl";
                        const isFixed = layout.numberingMode === "fixed";
                        const totalCols = rowSlots.length;
                        const activeSlots = rowSlots.filter((s) => s !== null).length;
                        const numsInRow = rowSlots.filter((s) => typeof s === "number");
                        const maxRowSeatNum = numsInRow.length > 0 ? Math.max(...numsInRow) : activeSlots;
                        let seqNum = 0;

                        return rowSlots.map((slot, slotIdx) => {
                          let displayNum = null;
                          if (slot !== null) {
                            seqNum++;
                            if (typeof slot === "number") {
                              displayNum = isRTL ? (maxRowSeatNum - slot + 1) : slot;
                            } else if (isFixed) {
                              displayNum = isRTL ? (totalCols - slotIdx) : (slotIdx + 1);
                            } else {
                              displayNum = isRTL ? (activeSlots - seqNum + 1) : seqNum;
                            }
                          }

                          return (
                            <div key={slotIdx} className="tle-slot-group">
                              <button
                                className={`tle-seat-btn ${slot === null ? "tle-seat-btn--gap" : "tle-seat-btn--seat"} tle-seat-btn--tier-${currentTier.toLowerCase()}`}
                                onClick={() => toggleSlot(rowLabel, slotIdx)}
                                title={slot === null ? "Gap — click to restore as seat" : `Seat ${rowLabel}${displayNum} (${currentTier} - ₹${tierPrices[currentTier]})`}
                              >
                                {displayNum !== null ? displayNum : "·"}
                              </button>
                              <button
                                className="tle-insert-gap"
                                onClick={() => insertGapAfter(rowLabel, slotIdx)}
                                title="Insert aisle gap here"
                              >|</button>
                            </div>
                          );
                        });
                      })()}
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

            {/* Legend */}
            <div className="tle-legend">
              <span className="tle-legend-item"><span className="tle-dot tle-dot--seat" />Seat</span>
              <span className="tle-legend-item"><span className="tle-dot tle-dot--gap" />Gap / Aisle</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                Click any seat to toggle · Select tier per row · Set category rates in top card
              </span>
            </div>
          </div>
        </div>
      );
    }
