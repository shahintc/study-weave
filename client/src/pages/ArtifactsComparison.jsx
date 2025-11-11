// ArtifactsComparison.jsx — React (.jsx)

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/** Small helper for ids */
const uid = () => Math.random().toString(36).slice(2, 9);

export default function ArtifactsComparison() {
  const [syncScroll, setSyncScroll] = useState("on");
  const [artifactChoice, setArtifactChoice] = useState("a");
  const [rating, setRating] = useState(3);
  const [viewMode, setViewMode] = useState("split");
  const [showBig, setShowBig] = useState(false); // Big View overlay

  // pane data: { type: 'text'|'image'|'pdf'|'doc', text?, url?, name? }
  const [leftData, setLeftData] = useState({ type: "text", text: "" });
  const [rightData, setRightData] = useState({ type: "text", text: "" });

  // annotations per pane: array of {id,start,end,color,comment}
  const [leftAnn, setLeftAnn] = useState([]);
  const [rightAnn, setRightAnn] = useState([]);

  // edit modes per pane
  const [leftEditing, setLeftEditing] = useState(false);
  const [rightEditing, setRightEditing] = useState(false);

  // draw toggles (for image/pdf)
  const [leftDraw, setLeftDraw] = useState(false);
  const [rightDraw, setRightDraw] = useState(false);

  // zoom factors (for image/pdf) — 1 = 100%
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const isSyncing = useRef(false);

  // refs to the actual editable DIVs (uncontrolled while typing)
  const leftEditRef = useRef(null);
  const rightEditRef = useRef(null);

  // live draft text while editing (kept in refs → no caret jump)
  const leftDraftRef = useRef("");
  const rightDraftRef = useRef("");

  // hidden file inputs
  const leftFileRef = useRef(null);
  const rightFileRef = useRef(null);

  // canvas refs and state for drawing
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  const leftDrawingState = useRef({ drawing: false, x: 0, y: 0 });
  const rightDrawingState = useRef({ drawing: false, x: 0, y: 0 });

  // accept images, pdf, text, word
  const ACCEPT = ".png,.jpg,.jpeg,.pdf,.txt,.doc,.docx";

  const radioClass =
    "relative h-4 w-4 rounded-full border border-gray-400 " +
    "data-[state=checked]:border-black data-[state=checked]:ring-2 data-[state=checked]:ring-black " +
    "before:content-[''] before:absolute before:inset-1 before:rounded-full before:bg-black " +
    "before:opacity-0 data-[state=checked]:before:opacity-100";

  // ===== SYNC SCROLL =====
  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const sync = (source, target) => {
      if (isSyncing.current) return;
      isSyncing.current = true;

      const vertMaxSrc = source.scrollHeight - source.clientHeight;
      const vertMaxTgt = target.scrollHeight - target.clientHeight;
      const ratioY = vertMaxSrc > 0 ? source.scrollTop / vertMaxSrc : 0;
      target.scrollTop = ratioY * vertMaxTgt;

      const horizMaxSrc = source.scrollWidth - source.clientWidth;
      const horizMaxTgt = target.scrollWidth - target.clientWidth;
      const ratioX = horizMaxSrc > 0 ? source.scrollLeft / horizMaxSrc : 0;
      target.scrollLeft = ratioX * horizMaxTgt;

      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    };

    const onLeftScroll = () => sync(left, right);
    const onRightScroll = () => sync(right, left);

    if (syncScroll === "on") {
      left.addEventListener("scroll", onLeftScroll, { passive: true });
      right.addEventListener("scroll", onRightScroll, { passive: true });
    }
    return () => {
      left.removeEventListener("scroll", onLeftScroll);
      right.removeEventListener("scroll", onRightScroll);
    };
  }, [syncScroll]);

  // clean up object URLs when they change / unmount
  useEffect(() => {
    return () => {
      if (leftData.url) URL.revokeObjectURL(leftData.url);
      if (rightData.url) URL.revokeObjectURL(rightData.url);
    };
  }, [leftData.url, rightData.url]);

  // ===== SEED/RESTORE EDITOR TEXT WHILE EDITING =====
  useLayoutEffect(() => {
    if (leftEditing && leftEditRef.current) {
      if (leftDraftRef.current === "" && (leftData.text || "") !== "") {
        leftDraftRef.current = leftData.text || "";
      }
      leftEditRef.current.innerText = leftDraftRef.current;
    }
  }, [leftEditing, leftAnn.length, showBig, viewMode]); // include showBig & viewMode

  useLayoutEffect(() => {
    if (rightEditing && rightEditRef.current) {
      if (rightDraftRef.current === "" && (rightData.text || "") !== "") {
        rightDraftRef.current = rightData.text || "";
      }
      rightEditRef.current.innerText = rightDraftRef.current;
    }
  }, [rightEditing, rightAnn.length, showBig, viewMode]); // include showBig & viewMode

  // ===== HELPERS =====
  const numberLines = (text) =>
    text
      .split(/\r?\n/)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");

  const handleUploadClick = (side) => {
    (side === "left" ? leftFileRef : rightFileRef).current?.click();
  };

  const setPaneData = (side, data) => {
    if (side === "left" && leftData.url && leftData.url !== data.url) {
      URL.revokeObjectURL(leftData.url);
    }
    if (side === "right" && rightData.url && rightData.url !== data.url) {
      URL.revokeObjectURL(rightData.url);
    }
    if (side === "left") {
      setLeftData(data);
      if (data.type !== "text") setLeftAnn([]);
      const c = leftCanvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      setLeftZoom(1);
    } else {
      setRightData(data);
      if (data.type !== "text") setRightAnn([]);
      const c = rightCanvasRef.current;
      if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      setRightZoom(1);
    }
  };

  const handleFileChange = async (e, side) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const name = file.name;
    const lower = name.toLowerCase();
    const isTxt = lower.endsWith(".txt");
    const isImg = lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    const isPdf = lower.endsWith(".pdf");
    const isDoc = lower.endsWith(".doc") || lower.endsWith(".docx");

    if (!(isTxt || isImg || isPdf || isDoc)) {
      alert("Unsupported file type. Allowed: .png, .jpg, .jpeg, .pdf, .txt, .doc, .docx");
      return;
    }

    if (isTxt) {
      const text = await file.text();
      setPaneData(side, { type: "text", text: numberLines(text), name });
      return;
    }

    const url = URL.createObjectURL(file);

    if (isImg) {
      setPaneData(side, { type: "image", url, name });
      return;
    }

    if (isPdf) {
      setPaneData(side, { type: "pdf", url, name });
      return;
    }

    if (isDoc) {
      setPaneData(side, { type: "doc", url, name });
      return;
    }
  };

  const handleDownload = (side) => {
    const pane = side === "left" ? leftData : rightData;

    if (pane.type === "text") {
      const blob = new Blob([pane.text ?? ""], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (side === "left" ? "artifactA" : "artifactB") + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    if (pane.url) {
      const a = document.createElement("a");
      a.href = pane.url;
      a.download = pane.name || (side === "left" ? "artifactA" : "artifactB");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  // ===== selection for TEXT panes =====
  /** Convert selection to [start,end] within ONLY the <code> text and clamp to the line
   * to avoid picking leading line number characters. */
  const selectionOffsets = (container) => {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const codeEl = container.querySelector?.("code") || container;
    if (!codeEl.contains(range.commonAncestorContainer)) return null;

    const pre = range.cloneRange();
    pre.setStart(codeEl, 0);
    let start = pre.toString().length;
    let end = start + range.toString().length;

    const full = codeEl.textContent ?? "";

    const lineStart = full.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextNL = full.indexOf("\n", start);
    const lineEnd = nextNL === -1 ? full.length : nextNL;
    if (start < lineStart) start = lineStart;
    if (end > lineEnd) end = lineEnd;

    while (start < end && /\s/.test(full[start])) start++;
    while (end > start && /\s/.test(full[end - 1])) end--;

    if (start >= end) return null;
    return { start, end };
  };

  /** Render helper: split text by highlights into spans */
  const renderWithHighlights = (text, anns) => {
    if (!anns || anns.length === 0) return [text];
    const ordered = [...anns].sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = 0;
    for (const a of ordered) {
      if (a.start > cursor) out.push(text.slice(cursor, a.start));
      out.push(
        <mark
          key={a.id}
          className="px-0.5 rounded"
          style={{ backgroundColor: a.color || "rgba(255, 235, 59, 0.7)" }}
          title={a.comment || ""}
        >
          {text.slice(a.start, a.end)}
        </mark>
      );
      cursor = a.end;
    }
    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  };

  /** Toggle edit: enter/exit. Commit draft back to state on exit. */
  const onToggleEdit = (side, val) => {
    if (side === "left") {
      const next = val ?? !leftEditing;
      if (next) {
        leftDraftRef.current = leftData.text || "";
      } else {
        const curr = leftEditRef.current?.innerText ?? leftDraftRef.current;
        const changed = curr !== (leftData.text || "");
        if (changed && leftAnn.length) setLeftAnn([]);
        setLeftData({ ...leftData, text: curr });
        leftDraftRef.current = curr;
      }
      setLeftEditing(next);
    } else {
      const next = val ?? !rightEditing;
      if (next) {
        rightDraftRef.current = rightData.text || "";
      } else {
        const curr = rightEditRef.current?.innerText ?? rightDraftRef.current;
        const changed = curr !== (rightData.text || "");
        if (changed && rightAnn.length) setRightAnn([]);
        setRightData({ ...rightData, text: curr });
        rightDraftRef.current = curr;
      }
      setRightEditing(next);
    }
  };

  // track typing into the draft refs (no React state updates)
  const onEditorInput = (side) => {
    const el = side === "left" ? leftEditRef.current : rightEditRef.current;
    const val = el?.innerText ?? "";
    if (side === "left") leftDraftRef.current = val;
    else rightDraftRef.current = val;
  };

  // === Add Comment (enabled only when editing) ===
  const onAddComment = (side) => {
    const container = (side === "left" ? leftRef : rightRef).current;
    const pane = side === "left" ? leftData : rightData;
    const editing = side === "left" ? leftEditing : rightEditing;
    if (!editing || !container || pane.type !== "text") return;

    if (side === "left" && leftEditing) {
      leftDraftRef.current = leftEditRef.current?.innerText ?? leftDraftRef.current;
    }
    if (side === "right" && rightEditing) {
      rightDraftRef.current = rightEditRef.current?.innerText ?? rightDraftRef.current;
    }

    const off = selectionOffsets(container);
    if (!off) {
      alert("Please select a text range first (with your mouse).");
      return;
    }
    const comment = prompt("Şərhinizi yazın:");
    if (comment == null) return;

    const ann = {
      id: uid(),
      start: off.start,
      end: off.end,
      color: "rgba(255, 235, 59, 0.75)",
      comment,
    };
    if (side === "left") setLeftAnn((a) => [...a, ann]);
    else setRightAnn((a) => [...a, ann]);
    window.getSelection()?.removeAllRanges();
  };

  // === Simple Highlight (no comment) — enabled only when editing) ===
  const onSimpleHighlight = (side) => {
    const container = (side === "left" ? leftRef : rightRef).current;
    const pane = side === "left" ? leftData : rightData;
    const editing = side === "left" ? leftEditing : rightEditing;
    if (!editing || !container || pane.type !== "text") return;

    if (side === "left" && leftEditing) {
      leftDraftRef.current = leftEditRef.current?.innerText ?? leftDraftRef.current;
    }
    if (side === "right" && rightEditing) {
      rightDraftRef.current = rightEditRef.current?.innerText ?? rightDraftRef.current;
    }

    const off = selectionOffsets(container);
    if (!off) {
      alert("Please select a text range first (with your mouse).");
      return;
    }

    const ann = {
      id: uid(),
      start: off.start,
      end: off.end,
      color: "rgba(135, 206, 250, 0.6)", // light blue
      comment: "",
    };
    if (side === "left") setLeftAnn((a) => [...a, ann]);
    else setRightAnn((a) => [...a, ann]);
    window.getSelection()?.removeAllRanges();
  };

  // ===== Drawing overlay helpers =====
  const setupCanvas = (canvas, targetEl) => {
    if (!canvas || !targetEl) return;
    const dpr = window.devicePixelRatio || 1;
    const w = targetEl.clientWidth;
    const h = targetEl.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
  };

  const getDrawBits = (side) => {
    const isLeft = side === "left";
    return {
      canvas: (isLeft ? leftCanvasRef : rightCanvasRef).current,
      state: isLeft ? leftDrawingState.current : rightDrawingState.current,
      zoom: isLeft ? leftZoom : rightZoom,
    };
  };

  const startDraw = (side, e) => {
    const { canvas, state, zoom } = getDrawBits(side);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    state.drawing = true;
    state.x = (e.clientX - rect.left) / Math.max(zoom, 0.001);
    state.y = (e.clientY - rect.top) / Math.max(zoom, 0.001);
  };

  const moveDraw = (side, e) => {
    const { canvas, state, zoom } = getDrawBits(side);
    if (!canvas || !state.drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(zoom, 0.001);
    const y = (e.clientY - rect.top) / Math.max(zoom, 0.001);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(state.x, state.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.x = x;
    state.y = y;
  };

  const endDraw = () => {
    leftDrawingState.current.drawing = false;
    rightDrawingState.current.drawing = false;
  };

  // Resize canvas when needed
  useEffect(() => {
    const doSize = () => {
      const lTarget =
        leftRef.current?.querySelector(".draw-target") ||
        leftRef.current?.querySelector("iframe") ||
        leftRef.current?.querySelector("img");
      if (leftDraw && leftCanvasRef.current && lTarget) {
        setupCanvas(leftCanvasRef.current, lTarget);
      }
      const rTarget =
        rightRef.current?.querySelector(".draw-target") ||
        rightRef.current?.querySelector("iframe") ||
        rightRef.current?.querySelector("img");
      if (rightDraw && rightCanvasRef.current && rTarget) {
        setupCanvas(rightCanvasRef.current, rTarget);
      }
    };
    doSize();
    window.addEventListener("resize", doSize);
    return () => window.removeEventListener("resize", doSize);
  }, [leftDraw, rightDraw, leftData, rightData, viewMode, leftZoom, rightZoom, showBig]);

  const toggleDraw = (side) => {
    if (side === "left") setLeftDraw((v) => !v);
    else setRightDraw((v) => !v);
  };

  const clearCanvas = (side) => {
    const c = side === "left" ? leftCanvasRef.current : rightCanvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };

  // ===== Zoom helpers =====
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const changeZoom = (side, step) => {
    if (side === "left") setLeftZoom((z) => clamp((z * 100 + step) / 100, 0.25, 5));
    else setRightZoom((z) => clamp((z * 100 + step) / 100, 0.25, 5));
  };
  const setZoom = (side, value) => {
    if (side === "left") setLeftZoom(clamp(value, 0.25, 5));
    else setRightZoom(clamp(value, 0.25, 5));
  };
  const zoomPct = (z) => Math.round(z * 100);

  const onDeleteAnn = (side, id) => {
    if (side === "left") setLeftAnn((a) => a.filter((x) => x.id !== id));
    else setRightAnn((a) => a.filter((x) => x.id !== id));
  };

  // DISABLE renumber while editing + guard in code
  const onRenumber = (side) => {
    if ((side === "left" && leftEditing) || (side === "right" && rightEditing)) {
      return;
    }
    const pane = side === "left" ? leftData : rightData;
    if (pane.type !== "text") return;
    const ren = numberLines((pane.text || "").replace(/^\s*\d+\.\s/gm, ""));
    if (side === "left") {
      if (leftAnn.length) setLeftAnn([]);
      setLeftData({ ...leftData, text: ren });
    } else {
      if (rightAnn.length) setRightAnn([]);
      setRightData({ ...rightData, text: ren });
    }
  };

  // Big View opener — capture drafts first so editor doesn't clear
  const openBigView = () => {
    if (leftEditing) {
      leftDraftRef.current = leftEditRef.current?.innerText ?? leftDraftRef.current;
    }
    if (rightEditing) {
      rightDraftRef.current = rightEditRef.current?.innerText ?? rightDraftRef.current;
    }
    setShowBig(true);
  };

  // ===== UI SUB-COMPONENTS =====
  const PaneToolbar = ({ title, side }) => {
    const pane = side === "left" ? leftData : rightData;
    const editing = side === "left" ? leftEditing : rightEditing;
    const isText = pane.type === "text";
    const canAnnotate = isText && editing;

    const isVisual = pane.type === "image" || pane.type === "pdf";
    const drawActive = side === "left" ? leftDraw : rightDraw;
    const z = side === "left" ? leftZoom : rightZoom;

    const baseBtn =
      "rounded px-2 py-1 text-xs border " +
      (canAnnotate ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400");

    const drawBtnClass =
      "rounded px-2 py-1 text-xs border " +
      (isVisual ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400") +
      (drawActive ? " bg-gray-100" : "");

    const visualBtn =
      "rounded px-2 py-1 text-xs border " +
      (isVisual ? "hover:bg-gray-100" : "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400");

    return (
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          {isText && (
            <>
              <button
                className="rounded px-2 py-1 text-xs border hover:bg-gray-100"
                title={editing ? "Done" : "Edit"}
                onClick={() => onToggleEdit(side)}
              >
                {editing ? "Done" : "Edit"}
              </button>

              <button
                className={baseBtn}
                title="Highlight selection"
                onClick={() => onSimpleHighlight(side)}
                disabled={!canAnnotate}
              >
                Highlight
              </button>

              <button
                className={baseBtn}
                title="Add Comment (highlight)"
                onClick={() => onAddComment(side)}
                disabled={!canAnnotate}
              >
                Add Comment
              </button>

              <button
                className={`rounded px-2 py-1 text-xs border ${
                  editing
                    ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400"
                    : "hover:bg-gray-100"
                }`}
                title="Renumber lines"
                onClick={() => {
                  if (!editing) onRenumber(side);
                }}
                disabled={editing}
              >
                Renumber
              </button>
            </>
          )}

          {/* Draw + Zoom tools for image / pdf */}
          {isVisual && (
            <>
              <div className="hidden sm:flex items-center gap-1">
                <button className={visualBtn} onClick={() => changeZoom(side, -10)} title="Zoom out">−</button>
                <span className="text-xs w-12 text-center tabular-nums">{zoomPct(z)}%</span>
                <button className={visualBtn} onClick={() => changeZoom(side, +10)} title="Zoom in">+</button>
                <button className={visualBtn} onClick={() => setZoom(side, 1)} title="Reset zoom to 100%">100%</button>
              </div>

              <button
                className={drawBtnClass}
                title="Toggle Draw Mode (freehand)"
                onClick={() => toggleDraw(side)}
                disabled={!isVisual}
              >
                {drawActive ? "Drawing: On" : "Draw"}
              </button>
              <button
                className={visualBtn}
                title="Clear drawings"
                onClick={() => clearCanvas(side)}
                disabled={!isVisual}
              >
                Clear Draw
              </button>
            </>
          )}

          <button
            className="rounded p-1 hover:bg-gray-100"
            title="Download"
            onClick={() => handleDownload(side)}
          >
            ⬇
          </button>
          <button
            className="rounded p-1 hover:bg-gray-100"
            title="Upload"
            onClick={() => handleUploadClick(side)}
          >
            ⬆
          </button>
        </div>
      </div>
    );
  };

  const PaneViewer = ({ innerRef, pane, side, tall = false }) => {
    const editing = side === "left" ? leftEditing : rightEditing;
    const anns = side === "left" ? leftAnn : rightAnn;
    const drawActive = side === "left" ? leftDraw : rightDraw;
    const zoom = side === "left" ? leftZoom : rightZoom;

    const box =
      (tall ? "h-[78vh] " : "h-80 ") + "overflow-auto rounded-md border bg-white text-sm";

    // IMAGE
    if (pane.type === "image" && pane.url) {
      return (
        <div ref={innerRef} className={box}>
          <div className="relative inline-block">
            <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
              <img
                src={pane.url}
                alt={pane.name || "uploaded image"}
                className={`draw-target ${tall ? "max-h-[78vh]" : "max-h-80"} object-contain`}
                onLoad={(e) => {
                  const imgEl = e.currentTarget;
                  const canvas = (side === "left" ? leftCanvasRef : rightCanvasRef).current;
                  if (canvas) setupCanvas(canvas, imgEl);
                }}
              />
              <canvas
                ref={side === "left" ? leftCanvasRef : rightCanvasRef}
                className="absolute inset-0"
                style={{ pointerEvents: drawActive ? "auto" : "none", touchAction: "none" }}
                onMouseDown={(e) => drawActive && startDraw(side, e)}
                onMouseMove={(e) => drawActive && moveDraw(side, e)}
                onMouseUp={() => drawActive && endDraw()}
                onMouseLeave={() => drawActive && endDraw()}
              />
            </div>
          </div>
        </div>
      );
    }

    // PDF
    if (pane.type === "pdf" && pane.url) {
      return (
        <div ref={innerRef} className={box}>
          <div className="relative inline-block">
            <div
              className="relative draw-target"
              style={{
                width: tall ? "70rem" : "40rem",
                height: tall ? "36rem" : "20rem",
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              <iframe
                title={pane.name || "PDF preview"}
                src={pane.url}
                className="w-full h-full"
                onLoad={(e) => {
                  const target = e.currentTarget;
                  const canvas = (side === "left" ? leftCanvasRef : rightCanvasRef).current;
                  if (canvas) setupCanvas(canvas, target);
                }}
              />
              <canvas
                ref={side === "left" ? leftCanvasRef : rightCanvasRef}
                className="absolute inset-0"
                style={{ pointerEvents: drawActive ? "auto" : "none", touchAction: "none" }}
                onMouseDown={(e) => drawActive && startDraw(side, e)}
                onMouseMove={(e) => drawActive && moveDraw(side, e)}
                onMouseUp={() => drawActive && endDraw()}
                onMouseLeave={() => drawActive && endDraw()}
              />
            </div>
          </div>
        </div>
      );
    }

    // DOC
    if (pane.type === "doc" && pane.url) {
      return (
        <div ref={innerRef} className={box + " p-4"}>
          <div className="text-gray-700">
            <div className="font-medium mb-2">{pane.name || "Word document"}</div>
            <p className="mb-3">Preview of Word files isn’t supported by the browser without a converter.</p>
            <div className="flex gap-2">
              <a href={pane.url} download={pane.name || "document"} className="rounded border px-3 py-1 hover:bg-gray-50">Download</a>
              <a href={pane.url} target="_blank" rel="noreferrer" className="rounded border px-3 py-1 hover:bg-gray-50">Open in Word</a>
            </div>
          </div>
        </div>
      );
    }

    // TEXT
    const content = pane.text || "";
    if (editing) {
      return (
        <div ref={innerRef} className={box + " font-mono"}>
          <div
            ref={side === "left" ? leftEditRef : rightEditRef}
            className="whitespace-pre p-4 min-w-max outline-none"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={() => onEditorInput(side)}
          />
          {((side === "left" ? leftAnn : rightAnn).length > 0) && (
            <div className="px-4 py-2 text-xs text-amber-700">
              * Note: Highlights are hidden while editing. If you change the text, highlight ranges may become invalid and will be cleared.
            </div>
          )}
        </div>
      );
    }
    return (
      <div ref={innerRef} className={box + " font-mono"}>
        <pre className="whitespace-pre p-4 min-w-max">
          <code>{renderWithHighlights(content, anns)}</code>
        </pre>
      </div>
    );
  };

  const AnnotationsList = ({ side }) => {
    const pane = side === "left" ? leftData : rightData;
    const anns = side === "left" ? leftAnn : rightAnn;
    if (pane.type !== "text" || anns.length === 0) return null;

    const content = pane.text || "";
    return (
      <div className="border-t px-4 py-3 text-sm bg-gray-50">
        <div className="font-medium mb-2">Comments</div>
        <ul className="space-y-2">
          {anns
            .sort((a, b) => a.start - b.start)
            .map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-gray-700">{a.comment || "Highlight"}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    “{content.slice(a.start, Math.min(a.end, a.start + 80)).replace(/\n/g, " ↵ ")}”
                  </div>
                </div>
                <button
                  className="text-red-600 text-sm hover:underline"
                  onClick={() => onDeleteAnn(side, a.id)}
                  title="Delete comment"
                >
                  🗑
                </button>
              </li>
            ))}
        </ul>
      </div>
    );
  };

  // ===== RENDER =====
  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      {/* hidden file inputs */}
      <input
        ref={leftFileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFileChange(e, "left")}
      />
      <input
        ref={rightFileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFileChange(e, "right")}
      />

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Study: AI vs. Human Code Readability (Task 3 of 3)
        </h2>
        {/* Open both panes in a larger overlay */}
        <button
          className="rounded p-2 border hover:bg-gray-50"
          onClick={openBigView}
          title="Open Big View"
        >
          ⛶
        </button>
      </div>

      {viewMode === "split" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <PaneToolbar title="Artifact A" side="left" />
            <CardContent className="pt-0">
              <PaneViewer innerRef={leftRef} pane={leftData} side="left" />
            </CardContent>
            <AnnotationsList side="left" />
          </Card>

          <Card>
            <PaneToolbar title="Artifact B" side="right" />
            <CardContent className="pt-0">
              <PaneViewer innerRef={rightRef} pane={rightData} side="right" />
            </CardContent>
            <AnnotationsList side="right" />
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <PaneToolbar title="Artifact A" side="left" />
            <CardContent className="pt-0">
              <PaneViewer innerRef={leftRef} pane={leftData} side="left" />
            </CardContent>
            <AnnotationsList side="left" />
          </Card>
          <Card>
            <PaneToolbar title="Artifact B" side="right" />
            <CardContent className="pt-0">
              <PaneViewer innerRef={rightRef} pane={rightData} side="right" />
            </CardContent>
            <AnnotationsList side="right" />
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (leftData.url) URL.revokeObjectURL(leftData.url);
                  if (rightData.url) URL.revokeObjectURL(rightData.url);
                  setLeftData({ type: "text", text: "" });
                  setRightData({ type: "text", text: "" });
                  setLeftAnn([]);
                  setRightAnn([]);
                  setLeftEditing(false);
                  setRightEditing(false);
                  setLeftDraw(false);
                  setRightDraw(false);
                  setLeftZoom(1);
                  setRightZoom(1);
                  const lc = leftCanvasRef.current;
                  const rc = rightCanvasRef.current;
                  if (lc) lc.getContext("2d")?.clearRect(0, 0, lc.width, lc.height);
                  if (rc) rc.getContext("2d")?.clearRect(0, 0, rc.width, rc.height);
                  leftRef.current?.scrollTo({ top: 0, left: 0 });
                  rightRef.current?.scrollTo({ top: 0, left: 0 });
                }}
              >
                Reset
              </Button>
              <Button variant="outline">Save in Browser</Button>
              <Button variant="outline">Share as URL</Button>
              <Button variant="outline">Collapse All</Button>
              <Button variant="outline">Expand All</Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border">
                <button
                  className={`px-3 py-1 text-sm ${
                    viewMode === "split" ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                  onClick={() => setViewMode("split")}
                >
                  Split
                </button>
                <button
                  className={`px-3 py-1 text-sm border-l ${
                    viewMode === "unified" ? "bg-gray-100 font-medium" : "bg-white"
                  }`}
                  onClick={() => setViewMode("unified")}
                >
                  Unified
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Label className="font-semibold">Sync Scrolling:</Label>
            <RadioGroup
              value={syncScroll}
              onValueChange={setSyncScroll}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem className={radioClass} value="on" id="sync-on" />
                <Label htmlFor="sync-on">On</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem className={radioClass} value="off" id="sync-off" />
                <Label htmlFor="sync-off">Off</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="font-semibold">Rate "Readability" (1–5 Stars):</Label>
            <RadioGroup
              value={String(rating)}
              onValueChange={(v) => setRating(Number(v))}
              className="flex space-x-3"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-center space-x-1">
                  <RadioGroupItem
                    className={radioClass}
                    value={String(n)}
                    id={`star-${n}`}
                  />
                  <Label htmlFor={`star-${n}`}>⭐{n}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Which artifact was more readable?</Label>
            <RadioGroup
              value={artifactChoice}
              onValueChange={setArtifactChoice}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem className={radioClass} value="a" id="artifact-a" />
                <Label htmlFor="artifact-a">A</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem className={radioClass} value="b" id="artifact-b" />
                <Label htmlFor="artifact-b">B</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Annotations / Comments:</Label>
            <Textarea placeholder="Click text to highlight and add a comment." />
          </div>
        </CardContent>

        <CardFooter className="flex-wrap justify-between gap-4">
          <Button variant="outline">Save Draft</Button>
          <div className="flex items-center space-x-2">
            <Checkbox id="submit-final" />
            <Label htmlFor="submit-final">Submit Final Evaluation</Label>
            <Button>Submit</Button>
          </div>
        </CardFooter>
      </Card>

      {/* ==== BIG VIEW OVERLAY (both panes, larger) ==== */}
      {showBig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-4 sm:inset-10 bg-white rounded-xl shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Big View</div>
              <button
                className="rounded px-3 py-1 text-sm border hover:bg-gray-100"
                onClick={() => setShowBig(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
              <Card className="h-full">
                <PaneToolbar title="Artifact A" side="left" />
                <CardContent className="pt-0 h-full">
                  <PaneViewer innerRef={leftRef} pane={leftData} side="left" tall />
                </CardContent>
                <AnnotationsList side="left" />
              </Card>
              <Card className="h-full">
                <PaneToolbar title="Artifact B" side="right" />
                <CardContent className="pt-0 h-full">
                  <PaneViewer innerRef={rightRef} pane={rightData} side="right" tall />
                </CardContent>
                <AnnotationsList side="right" />
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
