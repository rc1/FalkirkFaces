"use client";

// Hidden tweak panel. Live-adjusts the client-side feel (grid density, face
// zoom within tiles, animation timings, play pacing). Open it with the backtick
// key, ?debug in the URL, or 4 quick taps in the top-left corner.

export interface Dbg {
  tile: number; // 0 = responsive
  faceZoom: number; // CSS scale of the face inside its tile
  zoomMs: number;
  fadeDelay: number;
  dismissSpan: number;
  bloomStep: number;
  playHold: number;
}

export const DEFAULT_DBG: Dbg = {
  tile: 0,
  faceZoom: 1,
  zoomMs: 700,
  fadeDelay: 380,
  dismissSpan: 360,
  bloomStep: 7,
  playHold: 4000,
};

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="debug-row">
      <span className="debug-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="debug-val">{fmt ? fmt(value) : value}</span>
    </label>
  );
}

export default function DebugPanel({
  dbg,
  setDbg,
  onClose,
}: {
  dbg: Dbg;
  setDbg: (updater: (d: Dbg) => Dbg) => void;
  onClose: () => void;
}) {
  const set = (k: keyof Dbg) => (v: number) =>
    setDbg((d) => ({ ...d, [k]: v }));

  return (
    <div className="debug-panel">
      <div className="debug-head">
        <span>tweaks</span>
        <button onClick={onClose} aria-label="close debug">
          ✕
        </button>
      </div>

      <label className="debug-row debug-check">
        <input
          type="checkbox"
          checked={dbg.tile === 0}
          onChange={(e) =>
            setDbg((d) => ({ ...d, tile: e.target.checked ? 0 : 120 }))
          }
        />
        <span>tile size: responsive</span>
      </label>
      {dbg.tile !== 0 && (
        <Row label="tile px" value={dbg.tile} min={48} max={260} step={2} onChange={set("tile")} />
      )}

      <Row label="face zoom" value={dbg.faceZoom} min={0.8} max={2} step={0.02} onChange={set("faceZoom")} fmt={(v) => v.toFixed(2) + "×"} />
      <Row label="zoom ms" value={dbg.zoomMs} min={200} max={1500} step={20} onChange={set("zoomMs")} />
      <Row label="fade delay" value={dbg.fadeDelay} min={0} max={900} step={20} onChange={set("fadeDelay")} />
      <Row label="dismiss wave" value={dbg.dismissSpan} min={0} max={900} step={20} onChange={set("dismissSpan")} />
      <Row label="bloom step" value={dbg.bloomStep} min={0} max={30} step={1} onChange={set("bloomStep")} />
      <Row label="play hold" value={dbg.playHold} min={1000} max={8000} step={250} onChange={set("playHold")} />

      <div className="debug-actions">
        <button onClick={() => setDbg(() => DEFAULT_DBG)}>reset</button>
        <button
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(dbg, null, 2))}
        >
          copy
        </button>
      </div>
    </div>
  );
}
