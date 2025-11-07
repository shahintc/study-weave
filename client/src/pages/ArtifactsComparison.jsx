// ArtifactsComparison.jsx — React (.jsx)

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* demo content */
const artifactA = Array.from({ length: 120 }, (_, i) =>
  `${i + 1}. function process(data) { /* step ${i + 1} ... */ }`
).join("\n");
const artifactB = Array.from({ length: 105 }, (_, i) =>
  `${i + 1}. const process = (d) => { /* step ${i + 1} ... */ }`
).join("\n");

export default function ArtifactsComparison() {
  const [syncScroll, setSyncScroll] = useState("on");
  const [artifactChoice, setArtifactChoice] = useState("a");
  const [rating, setRating] = useState(3);

  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const isSyncing = useRef(false);

  const radioClass =
    "relative h-4 w-4 rounded-full border border-gray-400 " +
    "data-[state=checked]:border-black data-[state=checked]:ring-2 data-[state=checked]:ring-black " +
    "before:content-[''] before:absolute before:inset-1 before:rounded-full before:bg-black " +
    "before:opacity-0 data-[state=checked]:before:opacity-100";

  // sync scroll
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

      requestAnimationFrame(() => { isSyncing.current = false; });
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

  return (
    <div className="min-h-screen w-full bg-white">
      {/* ===== Header (left title, centered tabs, right profile; no pill on active) ===== */}
      <header className="w-full bg-white">
        <div className="mx-auto max-w-6xl px-6">
          {/* Use a 3-column grid so the center stays perfectly centered */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center py-4">
            {/* Left: title */}
            <h1 className="justify-self-start text-[26px] font-semibold leading-none text-black">
              Study Weave <span className="text-gray-600">(Researcher)</span>
            </h1>

            {/* Center: tabs (no outlines) */}
            <nav className="justify-self-center">
              <ul className="flex items-center gap-24 text-[15px] text-gray-700">
                <li><button className="hover:text-black">Dashboard</button></li>
                <li><button className="hover:text-black">My Studies</button></li>

                {/* Active tab with a subtle underline bar, no pill/outline */}
                <li className="relative">
                  <button className="font-medium text-black">Artifacts</button>
                  <span className="pointer-events-none absolute left-0 right-0 -bottom-2 h-[3px] rounded-full bg-gray-300" />
                </li>

                <li><button className="hover:text-black">Assess</button></li>
              </ul>
            </nav>

            {/* Right: profile (stick to the far right) */}
            <div className="justify-self-end">
              <button className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-1.5 shadow-sm hover:bg-gray-50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://i.pravatar.cc/100?u=DrAli" alt="Dr. Ali" />
                  <AvatarFallback>DA</AvatarFallback>
                </Avatar>
                <span className="text-[15px] font-medium text-black">Dr. Ali</span>
              </button>
            </div>
          </div>

          {/* Divider under the whole header */}
          <div className="h-px w-full bg-gray-200" />
        </div>
      </header>
      {/* ===== End Header ===== */}

      {/* ===== Body (unchanged) ===== */}
      <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
        <div className="mb-2">
          <h2 className="text-lg font-semibold">
            Study: AI vs. Human Code Readability (Task 3 of 3)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Artifact A (Blinded)</CardTitle></CardHeader>
            <CardContent>
              <div ref={leftRef} className="h-80 overflow-auto rounded-md border bg-white font-mono text-sm">
                <pre className="whitespace-pre p-4 min-w-max">
                  <code>{artifactA}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Artifact B (Blinded)</CardTitle></CardHeader>
            <CardContent>
              <div ref={rightRef} className="h-80 overflow-auto rounded-md border bg-white font-mono text-sm">
                <pre className="whitespace-pre p-4 min-w-max">
                  <code>{artifactB}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Label className="font-semibold">Sync Scrolling:</Label>
              <RadioGroup value={syncScroll} onValueChange={setSyncScroll} className="flex space-x-6">
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
          <CardHeader><CardTitle>Your Evaluation</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-semibold">Rate "Readability" (1–5 Stars):</Label>
              <RadioGroup value={String(rating)} onValueChange={(v) => setRating(Number(v))} className="flex space-x-3">
                {[1,2,3,4,5].map((n) => (
                  <div key={n} className="flex items-center space-x-1">
                    <RadioGroupItem className={radioClass} value={String(n)} id={`star-${n}`} />
                    <Label htmlFor={`star-${n}`}>⭐{n}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Which artifact was more readable?</Label>
              <RadioGroup value={artifactChoice} onValueChange={setArtifactChoice} className="flex space-x-4">
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
      </div>
    </div>
  );
}
