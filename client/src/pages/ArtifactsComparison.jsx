// ArtifactsComparison.jsx — React (.jsx)

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

/** Small helper for unique ids */
const uid = () => Math.random().toString(36).slice(2, 9);

/** Helper: Convert file to Base64 (for storage) */
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

/** Cache for blob URLs so we don't leak memory too much */
const blobUrlCache = new Map();

/** Helper: Convert Base64 back to Blob URL (for reliable PDF rendering) */
const base64ToBlobUrl = (base64) => {
  try {
    if (!base64) return null;
    if (blobUrlCache.has(base64)) return blobUrlCache.get(base64);

    const arr = base64.split(",");
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/pdf"; // fallback
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(base64, url);
    return url;
  } catch (e) {
    console.error("Failed to convert base64 to blob", e);
    return null;
  }
};

const STORAGE_KEY = "artifacts-comparison-autosave-v6-fixed";

export default function ArtifactsComparison() {
  const [syncScroll, setSyncScroll] = useState(true);
  const [artifactChoice, setArtifactChoice] = useState("a");
  const [rating, setRating] = useState(3);
  const [viewMode, setViewMode] = useState("split");
  const [showBig, setShowBig] = useState(false);

  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);

  // Pane Data
  const [leftData, setLeftData] = useState({ type: "text", text: "" });
  const [rightData, setRightData] = useState({ type: "text", text: "" });

  // Annotations
  const [leftAnn, setLeftAnn] = useState([]);
  const [rightAnn, setRightAnn] = useState([]);

  // Edit Modes
  const [leftEditing, setLeftEditing] = useState(false);
  const [rightEditing, setRightEditing] = useState(false);

  // Draw Toggles
  const [leftDraw, setLeftDraw] = useState(false);
  const [rightDraw, setRightDraw] = useState(false);

  // Zoom
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);

  // Summaries
  const [leftSummary, setLeftSummary] = useState("");
  const [rightSummary, setRightSummary] = useState("");
  const [leftSummaryStatus, setLeftSummaryStatus] = useState("idle");
  const [rightSummaryStatus, setRightSummaryStatus] = useState("idle");

  // Pending Comment State
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [pendingComment, setPendingComment] = useState("");

  const autosaveTimerRef = useRef(null);

  // Refs
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const leftBigRef = useRef(null);
  const rightBigRef = useRef(null);
  const isSyncing = useRef(false);

  const leftEditRef = useRef(null);
  const rightEditRef = useRef(null);

  const leftDraftRef = useRef("");
  const rightDraftRef = useRef("");

  const leftFileRef = useRef(null);
  const rightFileRef = useRef(null);

  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  const leftBigCanvasRef = useRef(null);
  const rightBigCanvasRef = useRef(null);

  const leftDrawingState = useRef({ drawing: false, x: 0, y: 0 });
  const rightDrawingState = useRef({ drawing: false, x: 0, y: 0 });

  const ACCEPT = ".png,.jpg,.jpeg,.pdf,.txt,.doc,.docx";
  const radioClass =
    "relative h-4 w-4 rounded-full border border-gray-400 data-[state=checked]:border-black data-[state=checked]:ring-2 data-[state=checked]:ring-black before:content-[''] before:absolute before:inset-1 before:rounded-full before:bg-black before:opacity-0 data-[state=checked]:before:opacity-100";

  // 🔹 Initial Load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoadingArtifacts(false), 600);
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.left) setLeftData((prev) => ({ ...prev, ...saved.left }));
          if (saved.right) setRightData((prev) => ({ ...prev, ...saved.right }));
          if (Array.isArray(saved.leftAnn)) setLeftAnn(saved.leftAnn);
          if (Array.isArray(saved.rightAnn)) setRightAnn(saved.rightAnn);
          if (typeof saved.rating === "number") setRating(saved.rating);
          if (saved.artifactChoice) setArtifactChoice(saved.artifactChoice);
          if (typeof saved.syncScroll === "boolean") setSyncScroll(saved.syncScroll);
          if (saved.leftSummary) setLeftSummary(saved.leftSummary);
          if (saved.rightSummary) setRightSummary(saved.rightSummary);
        }
      } catch (err) {
        console.error("Failed to load state", err);
      }
    }
    return () => {
      clearTimeout(timer);
      // cleanup blob URLs
      blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
      blobUrlCache.clear();
    };
  }, []);

  // 🔹 Autosave
  const doSaveToLocalStorage = () => {
    if (typeof window === "undefined") return;
    try {
      const state = {
        left: leftData,
        right: rightData,
        leftAnn,
        rightAnn,
        rating,
        artifactChoice,
        syncScroll,
        leftSummary,
        rightSummary,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      // Ignore quota exceeded errors for large files
    }
  };

  const scheduleAutosave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(doSaveToLocalStorage, 1000);
  };

  useEffect(() => {
    scheduleAutosave();
  }, [
    leftData,
    rightData,
    leftAnn,
    rightAnn,
    rating,
    artifactChoice,
    syncScroll,
    leftSummary,
    rightSummary,
  ]);

  // ===== RESET =====
  const handleReset = () => {
    if (!confirm("Are you sure you want to reset everything?")) return;
    setLeftData({ type: "text", text: "" });
    setRightData({ type: "text", text: "" });
    setLeftAnn([]);
    setRightAnn([]);
    setRating(3);
    setArtifactChoice("a");
    setLeftSummary("");
    setRightSummary("");
    setLeftZoom(1);
    setRightZoom(1);

    [leftCanvasRef, rightCanvasRef, leftBigCanvasRef, rightBigCanvasRef].forEach(
      (ref) => {
        if (ref.current)
          ref.current
            .getContext("2d")
            ?.clearRect(0, 0, ref.current.width, ref.current.height);
      }
    );

    window.localStorage.removeItem(STORAGE_KEY);
  };

  // ===== SYNC SCROLL =====
  useEffect(() => {
    const lRef = showBig ? leftBigRef.current : leftRef.current;
    const rRef = showBig ? rightBigRef.current : rightRef.current;
    if (!lRef || !rRef) return;

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

    const onLeftScroll = () => sync(lRef, rRef);
    const onRightScroll = () => sync(rRef, lRef);

    if (syncScroll) {
      lRef.addEventListener("scroll", onLeftScroll, { passive: true });
      rRef.addEventListener("scroll", onRightScroll, { passive: true });
    }
    return () => {
      lRef.removeEventListener("scroll", onLeftScroll);
      rRef.removeEventListener("scroll", onRightScroll);
    };
  }, [syncScroll, showBig]);

  // ===== TEXT HELPERS =====
  const stripLineNumbers = (text) =>
    text ? text.replace(/^\s*\d+\.\s*/gm, "") : "";
  const numberLines = (text) => {
    if (!text) return "";
    return stripLineNumbers(text)
      .split(/\r?\n/)
      .map((line, idx) => `${idx + 1}. ${line}`)
      .join("\n");
  };

  const toggleEdit = (side) => {
    const isLeft = side === "left";
    const isEditing = isLeft ? leftEditing : rightEditing;
    const data = isLeft ? leftData : rightData;
    const setData = isLeft ? setLeftData : setRightData;
    const draftRef = isLeft ? leftDraftRef : rightDraftRef;
    const editRef = isLeft ? leftEditRef : rightEditRef;

    if (!isEditing) {
      draftRef.current = stripLineNumbers(data.text);
      if (isLeft) setLeftEditing(true);
      else setRightEditing(true);
    } else {
      const rawText = editRef.current?.innerText || draftRef.current;
      setData({ ...data, text: numberLines(rawText) });
      if (isLeft) setLeftEditing(false);
      else setRightEditing(false);
    }
  };

  // ===== FILE HANDLING =====
  const handleFileChange = async (e, side) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const name = file.name;
    const isTxt = name.toLowerCase().endsWith(".txt");
    const isImg = /\.(png|jpg|jpeg)$/i.test(name);
    const isPdf = name.toLowerCase().endsWith(".pdf");

    if (!(isTxt || isImg || isPdf)) {
      alert("Unsupported file type.");
      return;
    }

    const setData = side === "left" ? setLeftData : setRightData;
    if (side === "left") {
      setLeftAnn([]);
      setLeftZoom(1);
    } else {
      setRightAnn([]);
      setRightZoom(1);
    }

    if (isTxt) {
      const text = await file.text();
      setData({ type: "text", text: numberLines(text), name });
    } else {
      try {
        const base64Url = await fileToBase64(file); // data:...base64
        setData({ type: isImg ? "image" : "pdf", url: base64Url, name });
      } catch (err) {
        alert("Error reading file.");
      }
    }
  };

  const handleDownload = (side) => {
    const pane = side === "left" ? leftData : rightData;
    if (pane.type === "text") {
      const blob = new Blob([pane.text || ""], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (pane.name || `artifact-${side}`) + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (pane.url) {
      const link = document.createElement("a");
      link.href = pane.url; // base64 data URL (browser will still download)
      link.download = pane.name || `artifact-${side}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ===== SELECTION =====
  const selectionOffsets = (container) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(container);
    pre.setEnd(range.startContainer, range.startOffset);
    return {
      start: pre.toString().length,
      end: pre.toString().length + range.toString().length,
    };
  };

  const onSimpleHighlight = (side) => {
    const ref = showBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const container = ref.current?.querySelector('[data-content-area="true"]');
    if (!container) return;
    const off = selectionOffsets(container);
    if (!off || off.start >= off.end) {
      alert("Please select text first.");
      return;
    }

    const ann = {
      id: uid(),
      start: off.start,
      end: off.end,
      color: "rgba(255, 235, 59, 0.5)",
      comment: "",
    };
    if (side === "left") setLeftAnn((p) => [...p, ann]);
    else setRightAnn((p) => [...p, ann]);
    window.getSelection().removeAllRanges();
  };

  const onAddComment = (side) => {
    const ref = showBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const container = ref.current?.querySelector('[data-content-area="true"]');
    if (!container) return;

    const off = selectionOffsets(container);
    if (!off || off.start >= off.end) {
      alert("Please select text first.");
      return;
    }

    const text = (side === "left" ? leftData.text : rightData.text) || "";
    const snippet =
      text.slice(off.start, Math.min(off.end, off.start + 50)).trim() + "...";
    setPendingAnnotation({ side, start: off.start, end: off.end, snippet });
    window.getSelection().removeAllRanges();
  };

  const savePendingComment = () => {
    if (!pendingAnnotation) return;
    const ann = {
      id: uid(),
      start: pendingAnnotation.start,
      end: pendingAnnotation.end,
      color: "rgba(135, 206, 250, 0.5)",
      comment: pendingComment,
      snippet: pendingAnnotation.snippet,
    };
    if (pendingAnnotation.side === "left") setLeftAnn((p) => [...p, ann]);
    else setRightAnn((p) => [...p, ann]);
    setPendingAnnotation(null);
    setPendingComment("");
  };

  const onDeleteAnn = (side, id) => {
    if (side === "left") setLeftAnn((p) => p.filter((x) => x.id !== id));
    else setRightAnn((p) => p.filter((x) => x.id !== id));
  };

  const renderWithHighlights = (text, anns) => {
    if (!anns || !anns.length) return [text];
    const sorted = [...anns].sort((a, b) => a.start - b.start);
    const res = [];
    let last = 0;
    sorted.forEach((ann) => {
      if (ann.start > last) res.push(text.slice(last, ann.start));
      res.push(
        <mark
          key={ann.id}
          style={{ backgroundColor: ann.color }}
          title={ann.comment || "Highlight"}
          className="rounded px-0.5 cursor-pointer hover:opacity-80"
        >
          {text.slice(ann.start, ann.end)}
        </mark>
      );
      last = ann.end;
    });
    if (last < text.length) res.push(text.slice(last));
    return res;
  };

  // ===== DRAWING =====
  const refreshCanvas = (side, isBig = false) => {
    const canvasRef = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const wrapperRef = isBig
      ? side === "left"
        ? leftBigRef
        : rightBigRef
      : side === "left"
      ? leftRef
      : rightRef;
    const img = wrapperRef.current?.querySelector("img");
    const cvs = canvasRef.current;
    if (cvs && img) {
      const dpr = window.devicePixelRatio || 1;
      cvs.width = img.width * dpr;
      cvs.height = img.height * dpr;
      cvs.style.width = `${img.width}px`;
      cvs.style.height = `${img.height}px`;
      const ctx = cvs.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "red";
    }
  };

  const startDraw = (side, e, isBig) => {
    const ref = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    state.current = {
      drawing: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const moveDraw = (side, e, isBig) => {
    const ref = isBig
      ? side === "left"
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : side === "left"
      ? leftCanvasRef
      : rightCanvasRef;
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!state.current?.drawing || !ref.current) return;
    const ctx = ref.current.getContext("2d");
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(state.current.x, state.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.current = { ...state.current, x, y };
  };

  const endDraw = (side) => {
    const state = side === "left" ? leftDrawingState : rightDrawingState;
    if (!state.current) return;
    state.current.drawing = false;
  };

  const clearCanvas = (side) => {
    [
      side === "left" ? leftCanvasRef : rightCanvasRef,
      side === "left" ? leftBigCanvasRef : rightBigCanvasRef,
    ].forEach((ref) => {
      if (ref.current)
        ref.current
          .getContext("2d")
          ?.clearRect(0, 0, ref.current.width, ref.current.height);
    });
  };

  const summarizeSide = async (side) => {
    const setter = side === "left" ? setLeftSummary : setRightSummary;
    const statusSetter =
      side === "left" ? setLeftSummaryStatus : setRightSummaryStatus;
    const filename =
      (side === "left" ? leftData.name : rightData.name) || "Artifact";
    statusSetter("loading");
    setTimeout(() => {
      setter(
        `AI Summary: This artifact is of type ${
          side === "left" ? leftData.type : rightData.type
        } and contains ${filename}.`
      );
      statusSetter("idle");
    }, 1500);
  };

  // ===== SUB-COMPONENTS =====
  const AnnotationList = ({ side }) => {
    const anns = side === "left" ? leftAnn : rightAnn;
    if (anns.length === 0) return null;
    return (
      <div className="border-t bg-gray-50/50 p-3 max-h-48 overflow-y-auto">
        <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
          Comments & Highlights ({anns.length})
        </h4>
        <div className="space-y-2">
          {anns.map((ann) => (
            <div
              key={ann.id}
              className="text-xs bg-white p-2 rounded border flex justify-between gap-2 items-start group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: ann.color }}
                  ></div>
                  {ann.snippet && (
                    <span className="font-mono text-gray-600 truncate max-w-[150px]">
                      {ann.comment ? "Comment on:" : "Highlight:"} "
                      {ann.snippet.replace(/\n/g, " ")}"
                    </span>
                  )}
                </div>
                <p className="text-gray-800 pl-5 leading-relaxed">
                  {ann.comment || (
                    <i className="text-gray-400">No specific comment added.</i>
                  )}
                </p>
              </div>
              <button
                onClick={() => onDeleteAnn(side, ann.id)}
                className="text-gray-400 hover:text-red-500 transition-colors self-start p-1"
                title="Delete Annotation"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PaneToolbar = ({ side, title }) => {
    const isLeft = side === "left";
    const data = isLeft ? leftData : rightData;
    const editing = isLeft ? leftEditing : rightEditing;
    const isDraw = isLeft ? leftDraw : rightDraw;

    return (
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white min-h-[46px]">
        <span className="font-semibold text-sm mr-2 truncate">{title}</span>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {data.type === "text" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => toggleEdit(side)}
              >
                {editing ? "Done" : "Edit"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
                disabled={editing}
                onClick={() => onSimpleHighlight(side)}
              >
                Highlight
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
                disabled={editing}
                onClick={() => onAddComment(side)}
              >
                Comment
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  isLeft
                    ? setLeftZoom((z) => Math.max(0.1, z - 0.1))
                    : setRightZoom((z) => Math.max(0.1, z - 0.1))
                }
              >
                -
              </Button>
              <span className="text-xs w-8 text-center">
                {((isLeft ? leftZoom : rightZoom) * 100).toFixed(0)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  isLeft
                    ? setLeftZoom((z) => Math.min(3, z + 0.1))
                    : setRightZoom((z) => Math.min(3, z + 0.1))
                }
              >
                +
              </Button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <Button
                variant={isDraw ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  isLeft ? setLeftDraw(!leftDraw) : setRightDraw(!rightDraw)
                }
              >
                Draw
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => clearCanvas(side)}
              >
                Clear
              </Button>
            </>
          )}
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <input
            type="file"
            className="hidden"
            ref={isLeft ? leftFileRef : rightFileRef}
            accept={ACCEPT}
            onChange={(e) => handleFileChange(e, side)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() =>
              (isLeft ? leftFileRef : rightFileRef).current.click()
            }
            title="Upload"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleDownload(side)}
            title="Download"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = (side, isBig = false) => {
    const isLeft = side === "left";
    const data = isLeft ? leftData : rightData;
    const zoom = isLeft ? leftZoom : rightZoom;
    const editing = isLeft ? leftEditing : rightEditing;
    const ref = isBig
      ? isLeft
        ? leftBigRef
        : rightBigRef
      : isLeft
      ? leftRef
      : rightRef;
    const editRef = isLeft ? leftEditRef : rightEditRef;
    const canvasRef = isBig
      ? isLeft
        ? leftBigCanvasRef
        : rightBigCanvasRef
      : isLeft
      ? leftCanvasRef
      : rightCanvasRef;
    const isDraw = isLeft ? leftDraw : rightDraw;
    const anns = isLeft ? leftAnn : rightAnn;

    // Use blob URL for PDFs (from base64)
    let displayUrl = data.url;
    if (data.type === "pdf" && data.url && data.url.startsWith("data:")) {
      displayUrl = base64ToBlobUrl(data.url);
    }

    if (isLoadingArtifacts)
      return (
        <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400 animate-pulse">
          Loading...
        </div>
      );

    if (data.type === "text") {
      return (
        <div
          ref={ref}
          className="h-full w-full overflow-auto bg-white relative p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed"
        >
          {editing ? (
            <div
              contentEditable
              ref={editRef}
              className="outline-none h-full"
              suppressContentEditableWarning
            >
              {(isLeft ? leftDraftRef.current : rightDraftRef.current) ||
                data.text}
            </div>
          ) : (
            <div data-content-area="true" className="h-full">
              {renderWithHighlights(data.text || "", anns)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="h-full w-full overflow-auto bg-gray-100 flex items-start justify-center p-8 relative"
      >
        <div
          className="relative shadow-lg bg-white transition-transform origin-top"
          style={{ transform: `scale(${zoom})` }}
        >
          {data.type === "image" && (
            <img
              src={data.url}
              className="block max-w-none select-none"
              alt="Artifact"
              onLoad={() => refreshCanvas(side, isBig)}
            />
          )}

          {data.type === "pdf" && displayUrl && (
            <object
              data={displayUrl}
              type="application/pdf"
              className="block w-[800px] h-[1100px] border-none"
              style={{ pointerEvents: isDraw ? "none" : "auto" }}
            >
              <div className="p-4 text-center text-gray-500">
                Unable to display PDF.{" "}
                <a href={displayUrl} download className="underline">
                  Download
                </a>{" "}
                to view.
              </div>
            </object>
          )}

          <canvas
            ref={canvasRef}
            className={`absolute inset-0 z-10 ${
              isDraw ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
            }`}
            onMouseDown={(e) => isDraw && startDraw(side, e, isBig)}
            onMouseMove={(e) => isDraw && moveDraw(side, e, isBig)}
            onMouseUp={() => isDraw && endDraw(side)}
            onMouseLeave={() => isDraw && endDraw(side)}
          />
        </div>
      </div>
    );
  };

  const AISummary = ({ side }) => {
    const summary = side === "left" ? leftSummary : rightSummary;
    const status = side === "left" ? leftSummaryStatus : rightSummaryStatus;
    return (
      <div className="border-t p-3 bg-gray-50/50">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-gray-600">AI Summary</span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => summarizeSide(side)}
            disabled={status === "loading"}
          >
            {status === "loading" ? "..." : "Generate"}
          </Button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          {summary || "No summary generated yet."}
        </p>
      </div>
    );
  };

  // ===== MAIN RENDER =====
  return (
    <div className="min-h-screen bg-white p-6 text-gray-900 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Study: AI vs. Human Code Readability
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-md border">
              <Checkbox
                id="sync-mode"
                checked={syncScroll}
                onCheckedChange={(checked) => setSyncScroll(!!checked)}
              />
              <label
                htmlFor="sync-mode"
                className="text-sm font-medium cursor-pointer select-none"
              >
                Sync Scroll
              </label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const tD = leftData;
                setLeftData(rightData);
                setRightData(tD);
                const tA = leftAnn;
                setLeftAnn(rightAnn);
                setRightAnn(tA);
                const tS = leftSummary;
                setLeftSummary(rightSummary);
                setRightSummary(tS);
              }}
            >
              Swap Sides
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowBig(true)}
              title="Full Screen"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </Button>
          </div>
        </div>

        <div className="flex border rounded-lg h-[650px] shadow-sm overflow-hidden">
          <div className="flex-1 w-1/2 flex flex-col min-w-0 border-r relative">
            <PaneToolbar side="left" title="Artifact A" />
            <div className="flex-1 relative overflow-hidden">
              {renderContent("left", false)}
            </div>
            <AnnotationList side="left" />
            <AISummary side="left" />
          </div>
          <div className="flex-1 w-1/2 flex flex-col min-w-0 relative">
            <PaneToolbar side="right" title="Artifact B" />
            <div className="flex-1 relative overflow-hidden">
              {renderContent("right", false)}
            </div>
            <AnnotationList side="right" />
            <AISummary side="right" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Which artifact is better?</Label>
              <RadioGroup
                value={artifactChoice}
                onValueChange={setArtifactChoice}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="a"
                    id="r-a"
                    className={radioClass}
                  />
                  <Label htmlFor="r-a">Artifact A</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="b"
                    id="r-b"
                    className={radioClass}
                  />
                  <Label htmlFor="r-b">Artifact B</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <Label>Rate Readability (1-5)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`w-10 h-10 rounded border flex items-center justify-center transition-colors ${
                      rating >= n
                        ? "bg-yellow-400 border-yellow-500 text-white"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 flex justify-between">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleReset}
              >
                Reset Task
              </Button>
              <Button
                size="lg"
                className="bg-black text-white hover:bg-gray-800"
              >
                Save Assessment
              </Button>
            </div>
          </CardContent>
        </Card>

        {pendingAnnotation && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => setPendingAnnotation(null)}
          >
            <div
              className="bg-white p-6 rounded-lg shadow-xl w-[400px]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold mb-2">Add Comment</h3>
              <div className="text-xs text-gray-500 italic border-l-2 pl-2 mb-4 bg-gray-50 p-2 rounded">
                "{pendingAnnotation.snippet}"
              </div>
              <Textarea
                value={pendingComment}
                onChange={(e) => setPendingComment(e.target.value)}
                placeholder="Enter your comment here..."
                className="mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setPendingAnnotation(null)}
                >
                  Cancel
                </Button>
                <Button onClick={savePendingComment}>Save</Button>
              </div>
            </div>
          </div>
        )}

        {showBig && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200">
            <div className="border-b p-4 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-lg">Full Screen View</h2>
              <Button variant="outline" onClick={() => setShowBig(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 w-1/2 flex flex-col min-w-0 border-r relative">
                <PaneToolbar side="left" title="Artifact A" />
                <div className="flex-1 relative overflow-hidden">
                  {renderContent("left", true)}
                </div>
                <AnnotationList side="left" />
                <AISummary side="left" />
              </div>
              <div className="flex-1 w-1/2 flex flex-col min-w-0 relative">
                <PaneToolbar side="right" title="Artifact B" />
                <div className="flex-1 relative overflow-hidden">
                  {renderContent("right", true)}
                </div>
                <AnnotationList side="right" />
                <AISummary side="right" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
