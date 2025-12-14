import React, { useCallback, useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bell, LayoutDashboard, Shuffle, Brain, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const parseEstimatedSeconds = (value) => {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes * 60 : null;
};

export default function ParticipantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [resumeChip, setResumeChip] = useState(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [showGuestCompetencyModal, setShowGuestCompetencyModal] = useState(false);
  const [showGuestProfileModal, setShowGuestProfileModal] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!user || user.role !== "participant") return;
    const token = window.localStorage.getItem("token");
    if (!token) return;

    try {
      const { data } = await axios.get("/api/participant/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rawList = Array.isArray(data?.notifications) ? data.notifications : [];
      const fallback = buildAssignmentNotificationsFromStudies(data?.studies);
      const merged = dedupeNotifications([...rawList, ...fallback]);

      let filtered = merged;
      try {
        const readRaw = window.localStorage.getItem("participantNotificationsReadIds");
        const readIds = new Set(JSON.parse(readRaw || "[]"));
        filtered = merged.filter((item) => !readIds.has(item.id));
      } catch {
        filtered = merged;
      }
      setNotificationCount(filtered.length);
      setNotifications(filtered);
      window.localStorage.setItem("participantNotificationsCount", String(filtered.length));
      window.localStorage.setItem("participantNotificationsList", JSON.stringify(filtered));
      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate("/login");
      } else {
        console.error("Failed to refresh participant notifications", error);
      }
    }
  }, [navigate, user]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      const u = JSON.parse(raw);
      setUser(u);
      setAvatarUrl(resolveAvatarUrl(u?.avatarUrl));
      if (u.role !== "participant" && u.role !== "guest") {
        navigate("/researcher");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const syncUser = () => {
      try {
        const raw = window.localStorage.getItem("user");
        if (!raw) {
          setAvatarUrl("");
          return;
        }
        const parsed = JSON.parse(raw);
        setUser(parsed);
        setAvatarUrl(resolveAvatarUrl(parsed?.avatarUrl));
      } catch {
        setAvatarUrl("");
      }
    };
    const handler = (event) => {
      if (!event || event.key === null || event.key === "user") {
        syncUser();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const syncActive = () => {
      try {
        const raw = window.localStorage.getItem("competencyActive");
        if (!raw) {
          setResumeChip(null);
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.assignmentId) {
          setResumeChip({
            assignmentId: parsed.assignmentId,
            title: parsed.title || "Competency",
            estimatedTime: parsed.estimatedTime || "",
            startedAt: parsed.startedAt || null,
            durationSeconds: parsed.durationSeconds || null,
          });
        } else {
          setResumeChip(null);
        }
      } catch {
        setResumeChip(null);
      }
    };
    syncActive();
    const handler = () => syncActive();
    window.addEventListener("storage", handler);
    window.addEventListener("competency-active-changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("competency-active-changed", handler);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await refreshNotifications();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, refreshNotifications]);

  useEffect(() => {
    // Keep resume chip fresh on route changes within participant area
    try {
      const raw = window.localStorage.getItem("competencyActive");
      if (!raw) {
        setResumeChip(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.assignmentId) {
        setResumeChip({
          assignmentId: parsed.assignmentId,
          title: parsed.title || "Competency",
          estimatedTime: parsed.estimatedTime || "",
          startedAt: parsed.startedAt || null,
          durationSeconds: parsed.durationSeconds || null,
        });
      } else {
        setResumeChip(null);
      }
    } catch {
      setResumeChip(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const readCount = () => {
      const raw = window.localStorage.getItem("participantNotificationsCount");
      const num = Number(raw);
      setNotificationCount(Number.isFinite(num) ? num : 0);
      const listRaw = window.localStorage.getItem("participantNotificationsList");
      try {
        const parsed = JSON.parse(listRaw || "[]");
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      } catch {
        setNotifications([]);
      }
    };
    readCount();
    const handler = () => readCount();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const nav = [
    { to: "/participant", label: "Dashboard", key: "dashboard" },
    { to: "/participant/competency", label: "Competency", key: "competency" },
  ];

  const isGuest = user?.role === "guest";

  const handleNavClick = (itemTo) => {
    if (itemTo === "/participant/competency" && isGuest) {
      setShowGuestCompetencyModal(true);
      return;
    }
    navigate(itemTo);
  };

  const workspaceLabel = isGuest ? "Guest participant" : "Participant";

  return (
    <div className="min-h-screen bg-background">
      {resumeChip && location.pathname !== "/participant/competency"
        ? (() => {
            const durationSeconds =
              resumeChip.durationSeconds || parseEstimatedSeconds(resumeChip.estimatedTime);
            const remainingSeconds =
              durationSeconds && resumeChip.startedAt
                ? Math.max(durationSeconds - Math.floor((nowTs - resumeChip.startedAt) / 1000), 0)
                : null;
            return (
              <div className="fixed bottom-5 left-5 z-40 flex items-center gap-3 rounded-full border border-primary/20 bg-card/90 px-4 py-3 shadow-lg backdrop-blur">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wide text-primary">Active competency</span>
                  <span className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                    {resumeChip.title}
                  </span>
                </div>
                {Number.isFinite(remainingSeconds) ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {Math.max(Math.floor(remainingSeconds / 60), 0)}m left
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Resume
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => navigate("/participant/competency")}
                  aria-label="Return to active competency"
                >
                  Open
                </Button>
              </div>
            );
          })()
        : null}

      <div className="mx-auto flex w-full max-w-none gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <NavRail
            nav={nav}
            activePath={location.pathname}
            onSelect={handleNavClick}
            roleLabel={workspaceLabel}
            userName={user?.name}
          />
        </aside>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-0">
            <div className="p-4 pb-2">
              <NavRail
                nav={nav}
                activePath={location.pathname}
                onSelect={handleNavClick}
                roleLabel={workspaceLabel}
                userName={user?.name}
                dense
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 space-y-6">
          <header className="sticky top-4 z-10 rounded-2xl border bg-card/80 px-4 py-3 backdrop-blur-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {workspaceLabel} workspace
                  </span>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Study Weave</h1>
                    {isGuest ? (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        Guest
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {!isGuest ? (
                  <NotificationBell count={notificationCount} notifications={notifications} />
                ) : null}
                <UserNav
                  displayName={user?.name || (isGuest ? "Guest Participant" : "Participant")}
                  avatarUrl={avatarUrl}
                  onLogout={handleLogout}
                  isGuest={isGuest}
                  onGuestProfileBlocked={() => setShowGuestProfileModal(true)}
                />
              </div>
            </div>
          </header>

          <Outlet />
        </div>
      </div>

      <Dialog open={showGuestCompetencyModal} onOpenChange={setShowGuestCompetencyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription>
              Guest sessions can view public studies only. To take competency assessments, please sign in with a full participant account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setShowGuestCompetencyModal(false)}>
              Stay on dashboard
            </Button>
            <Button
              onClick={() => {
                setShowGuestCompetencyModal(false);
                handleLogout();
              }}
            >
              Go to login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuestProfileModal} onOpenChange={setShowGuestProfileModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile changes require an account</DialogTitle>
            <DialogDescription>
              You're browsing as a guest. Register or sign in to edit your profile and account settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setShowGuestProfileModal(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowGuestProfileModal(false);
                handleLogout();
              }}
            >
              Go to login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function resolveAvatarUrl(value) {
  if (!value) return "";
  try {
    const base = axios.defaults.baseURL || window.location.origin;
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

function NotificationBell({ count = 0, notifications = [] }) {
  const navigate = useNavigate();

  const persistState = (nextList, readIds) => {
    window.localStorage.setItem("participantNotificationsList", JSON.stringify(nextList));
    window.localStorage.setItem("participantNotificationsCount", String(nextList.length));
    if (readIds) {
      window.localStorage.setItem("participantNotificationsReadIds", JSON.stringify([...readIds]));
    }
    window.dispatchEvent(new Event("storage"));
  };

  const markNotifications = (ids = []) => {
    if (!ids.length) return;
    try {
      const rawRead = window.localStorage.getItem("participantNotificationsReadIds");
      const readIds = new Set(JSON.parse(rawRead || "[]"));
      ids.forEach((id) => {
        if (id) readIds.add(id);
      });
      const remaining = notifications.filter((n) => !ids.includes(n.id));
      persistState(remaining, readIds);
    } catch {
      // ignore storage errors
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification) return;
    markNotifications([notification.id]);
    navigateForNotification(notification);
  };

  const navigateForNotification = (notification) => {
    if (!notification) return;

    if (notification.type === "info") {
      // Reminder notifications are informational only; no navigation.
      return;
    }

    if (
      notification.type === "assignment" &&
      notification.cta &&
      notification.cta.type === "artifact" &&
      notification.cta.studyArtifactId &&
      notification.cta.mode
    ) {
      const params = new URLSearchParams();
      if (notification.cta.studyId) params.set("studyId", notification.cta.studyId);
      if (notification.cta.studyParticipantId) params.set("studyParticipantId", notification.cta.studyParticipantId);
      params.set("studyArtifactId", notification.cta.studyArtifactId);
      params.set("mode", notification.cta.mode);
      const search = params.toString();
      navigate(`/participant/artifacts-comparison?${search}`, {
        state: {
          studyId: notification.cta.studyId ? Number(notification.cta.studyId) : undefined,
          studyParticipantId: notification.cta.studyParticipantId
            ? Number(notification.cta.studyParticipantId)
            : undefined,
          studyArtifactId: Number(notification.cta.studyArtifactId),
          assignedMode: notification.cta.mode,
        },
      });
      return;
    }

    if (notification.type === "competency" && notification.assignmentId) {
      navigate("/participant/competency", {
        state: {
          assignmentId: Number(notification.assignmentId),
          studyId: notification.studyId ? Number(notification.studyId) : undefined,
        },
      });
      return;
    }

    if (notification.studyId) {
      const params = new URLSearchParams();
      params.set("studyId", notification.studyId);
      if (notification.studyParticipantId) {
        params.set("studyParticipantId", notification.studyParticipantId);
      }
      const search = params.toString();
      navigate(
        `/participant/artifacts-comparison${search ? `?${search}` : ""}`,
        {
          state: {
            studyId: Number(notification.studyId),
            studyParticipantId: notification.studyParticipantId
              ? Number(notification.studyParticipantId)
              : undefined,
          },
        },
      );
      return;
    }

    navigate("/participant");
  };

  const handleMarkAll = () => {
    markNotifications(notifications.map((n) => n.id));
  };

  const resolveTitle = (type) => {
    switch (type) {
      case "warning":
        return "⚠ Last day";
      case "info":
        return "ℹ Reminder";
      case "assignment":
        return "📄 New study";
      case "competency":
        return "🧠 New competency";
      default:
        return "Notification";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.length ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleMarkAll}>
              Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <DropdownMenuItem className="text-sm text-muted-foreground">
              You're all caught up.
            </DropdownMenuItem>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="whitespace-normal text-sm cursor-pointer"
                onSelect={() => handleNotificationClick(n)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{resolveTitle(n.type)}</span>
                  <span className="text-muted-foreground text-xs">{n.message}</span>
                  {n.studyId ? (
                    <span className="text-[11px] text-muted-foreground">Study #{n.studyId}</span>
                  ) : null}
                  {n.type === "competency" && n.assignmentId ? (
                    <span className="text-[11px] text-muted-foreground">
                      Competency #{n.assignmentId}
                    </span>
                  ) : null}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function buildAssignmentNotificationsFromStudies(studies = []) {
  if (!Array.isArray(studies) || !studies.length) return [];
  return studies
    .filter((study) => study && (study.studyParticipantId || study.id))
    .map((study) => {
      const studyParticipantId = study.studyParticipantId || study.id || null;
      const studyId = study.studyId || study.id || null;
      return {
        id: `${studyParticipantId}-assigned`,
        type: "assignment",
        message: `You were assigned to ${study.title || "a study"}.`,
        studyId: studyId ? String(studyId) : null,
        studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
        cta: study.cta || null,
        createdAt: study.timelineStart || study.lastUpdatedAt || new Date().toISOString(),
      };
    });
}

function dedupeNotifications(list = []) {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    if (!item || !item.id || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    result.push(item);
  });
  return result;
}

function UserNav({ displayName = "Participant", avatarUrl = "", onLogout, isGuest = false, onGuestProfileBlocked }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
            <AvatarFallback>{displayName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isGuest ? (
          <>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onGuestProfileBlocked?.();
              }}
            >
              Profile
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/profile">Profile</Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavRail({ nav = [], activePath = "", onSelect, roleLabel = "Participant", userName = "", dense = false }) {
  const iconMap = {
    "/participant": LayoutDashboard,
    "/participant/artifacts-comparison": Shuffle,
    "/participant/competency": Brain,
  };

  const itemBase =
    "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

  return (
    <div className={dense ? "space-y-4" : "space-y-6 p-2"}>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Navigation</p>
        <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
        {userName ? <p className="text-xs text-muted-foreground truncate">{userName}</p> : null}
      </div>
      <div className="space-y-1">
        {nav.map((item) => {
          const Icon = iconMap[item.to] || LayoutDashboard;
          const isActive =
            activePath === item.to ||
            activePath.startsWith(`${item.to}/`);
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => onSelect?.(item.to)}
              className={`${itemBase} ${isActive ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/60 text-foreground">
                <Icon className="h-5 w-5" />
                {isActive ? (
                  <span className="absolute inset-y-1 -left-2 w-1 rounded-full bg-primary/90" />
                ) : null}
              </span>
              <div className="flex flex-col items-start">
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
