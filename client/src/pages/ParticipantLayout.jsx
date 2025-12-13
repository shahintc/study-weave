import React, { useCallback, useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";
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

export default function ParticipantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

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
  const [showGuestCompetencyModal, setShowGuestCompetencyModal] = useState(false);

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
    { to: "/participant/artifacts-comparison", label: "Artifacts Comparison", key: "artifacts" },
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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Study Weave ({isGuest ? "Guest Participant" : "Participant"})
        </h1>
        <div className="flex items-center gap-3">
          {!isGuest ? (
            <NotificationBell count={notificationCount} notifications={notifications} />
          ) : null}
          <UserNav displayName={user?.name || (isGuest ? "Guest Participant" : "Participant")} avatarUrl={avatarUrl} onLogout={handleLogout} />
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b pb-4">
        {nav.map((item) => (
          <Button
            key={item.key}
            variant={location.pathname === item.to ? "secondary" : "ghost"}
            className="rounded-full"
            onClick={() => handleNavClick(item.to)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      <Outlet />

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

function UserNav({ displayName = "Participant", avatarUrl = "", onLogout }) {
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
        <DropdownMenuItem asChild>
          <Link to="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
