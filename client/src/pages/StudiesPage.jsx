import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Users, Trash2, Archive, Loader2 } from "lucide-react";

function StudiesPage({ archived = false }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [studies, setStudies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingActionId, setPendingActionId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, study: null });

  const pageTitle = archived ? "Archived Studies" : "My Studies";
  const pageDescription = archived
    ? "Read-only archive of completed or parked studies."
    : "Manage your active and in-progress studies.";

  const loadStudies = async (researcherId) => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/researcher/studies", {
        params: {
          researcherId,
          archived: archived ? "true" : "false",
        },
      });
      setStudies(data.studies || []);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load studies right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const rawUser = window.localStorage.getItem("user");
    const token = window.localStorage.getItem("token");
    if (!rawUser || !token) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(rawUser);
      setUser(parsed);
      if (parsed.role !== "researcher") {
        navigate("/participant");
        return;
      }
      loadStudies(parsed.id);
    } catch {
      navigate("/login");
    }
  }, [archived, navigate]);

  const actionLabel = useMemo(
    () => (archived ? "Delete" : "Archive or delete"),
    [archived],
  );

  const openConfirm = (type, study) => {
    setConfirmDialog({ open: true, type, study });
  };

  const closeConfirm = () => {
    setConfirmDialog({ open: false, type: null, study: null });
  };

  const archiveStudy = async (studyId) => {
    setPendingActionId(studyId);
    setError("");
    try {
      await api.patch(`/api/researcher/studies/${studyId}/archive`);
      setStudies((prev) => prev.filter((study) => String(study.id) !== String(studyId)));
      setActionMessage("Study archived and moved to Archived Studies.");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to archive this study.";
      setError(message);
    } finally {
      setPendingActionId(null);
    }
  };

  const deleteStudy = async (studyId) => {
    setPendingActionId(studyId);
    setError("");
    try {
      await api.delete(`/api/researcher/studies/${studyId}`);
      setStudies((prev) => prev.filter((study) => String(study.id) !== String(studyId)));
      setActionMessage("Study deleted permanently.");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to delete this study.";
      setError(message);
    } finally {
      setPendingActionId(null);
    }
  };

  const handleConfirmAction = async () => {
    const { type, study } = confirmDialog;
    if (!study || !type) {
      return;
    }
    if (type === "archive") {
      await archiveStudy(study.id);
    }
    if (type === "delete") {
      await deleteStudy(study.id);
    }
    closeConfirm();
  };

  const renderStudyRow = (study) => {
    const busy = pendingActionId !== null && String(pendingActionId) === String(study.id);
    return (
      <div
        key={study.id}
        className="grid gap-4 border-b pb-6 last:border-none last:pb-0 lg:grid-cols-[2fr,1.2fr,auto]"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{study.title}</h3>
            <Badge
              variant="outline"
              className={
                study.health === "attention"
                  ? "border-amber-200 text-amber-600"
                  : "border-emerald-200 text-emerald-600"
              }
            >
              {study.status}
            </Badge>
            {study.allowReviewers ? (
              <Badge variant="secondary" className="bg-slate-900 text-white">
                Reviewers enabled
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{study.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {study.window}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {study.participants}/{study.participantTarget} participants
            </span>
            <span>{study.nextMilestone}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quality</p>
          <p className="text-2xl font-semibold">{Number(study.avgRating ?? 0).toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Average participant rating</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!archived && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => openConfirm("archive", study)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              openConfirm("delete", study);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {(!archived && (actionMessage || error)) ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>{pageTitle}</CardTitle>
              <CardDescription>{pageDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionMessage && <p className="text-sm text-emerald-700">{actionMessage}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">Actions: {actionLabel}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{pageTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {archived ? "Archived studies are read-only." : "Archive to preserve history or delete permanently."}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{archived ? "Archived" : "Active"} pipelines</CardTitle>
            <CardDescription>
              {archived ? "Archived studies stay here for reference." : "Progress, quality, and actions per study."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading studies...</p>
            ) : !studies.length ? (
              <p className="text-sm text-muted-foreground">
                {archived ? "No archived studies yet." : "No studies yet. Create one to get started."}
              </p>
            ) : (
              studies.map((study) => renderStudyRow(study))
            )}
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "delete" ? "Delete this study?" : "Archive this study?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "delete"
                ? "This removes the study and its related data. This action cannot be undone."
                : "The study will become read-only and move to Archived Studies."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirm}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={pendingActionId !== null}
            >
              {pendingActionId !== null ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {confirmDialog.type === "delete" ? "Delete" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default StudiesPage;
