import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { GripVertical, RefreshCcw, Save, Undo2 } from "lucide-react";

const formatTimestamp = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
};

export default function DashboardControls({
  filters,
  onFiltersChange,
  studyOptions = [],
  layout = [],
  onLayoutChange,
  widgetLabels = {},
  onReset,
  onSave,
  saving = false,
  lastSavedAt = null,
  saveError = "",
  criteriaPlaceholder = "Filter by criteria",
}) {
  const [dragging, setDragging] = useState(null);

  const handleDragStart = (event, id) => {
    setDragging(id);
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    setDragging(null);
    if (!sourceId || sourceId === targetId) return;
    const currentIndex = layout.findIndex((item) => item === sourceId);
    const targetIndex = layout.findIndex((item) => item === targetId);
    if (currentIndex === -1 || targetIndex === -1) return;
    const next = [...layout];
    next.splice(targetIndex, 0, next.splice(currentIndex, 1)[0]);
    onLayoutChange(next);
  };

  const handleDragOver = (event) => event.preventDefault();

  const handleInputChange = (key, value) => {
    onFiltersChange({ [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Dashboard controls</CardTitle>
        <CardDescription>Filter what you see and rearrange widgets to match your workflow.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[2fr,1.2fr]">
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Study</p>
              <Select value={filters.study ?? "all"} onValueChange={(value) => handleInputChange("study", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All studies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All studies</SelectItem>
                  {studyOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Criteria</p>
              <Input
                placeholder={criteriaPlaceholder}
                value={filters.criteria ?? ""}
                onChange={(event) => handleInputChange("criteria", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">From</p>
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(event) => handleInputChange("from", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <Input
                type="date"
                value={filters.to ?? ""}
                min={filters.from || undefined}
                onChange={(event) => handleInputChange("to", event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Filters are remembered automatically. Use save to sync to your profile.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Layout</p>
              <p className="text-xs text-muted-foreground">Drag to reorder widgets.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onReset} title="Reset to default layout">
              <Undo2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {layout.map((id) => (
              <div
                key={id}
                draggable
                onDragStart={(event) => handleDragStart(event, id)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, id)}
                className={`flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition ${
                  dragging === id ? "opacity-60 ring-2 ring-primary/40" : "hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  {widgetLabels[id] || id}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Drag</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {lastSavedAt ? `Last saved ${formatTimestamp(lastSavedAt)}` : "Not saved to profile yet."}
          {saveError ? (
            <span className="ml-2 text-destructive">{saveError}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset layout
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4 animate-spin" />
                Saving
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save preferences
              </span>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
