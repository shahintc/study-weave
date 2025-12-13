import React, { useEffect, useMemo, useState, useCallback } from "react";
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

export default function ResearcherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const NOTIFICATIONS_REFRESH_MS = 30_000;
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const refreshNotifications = useCallback(async () => {
    if (!user || (user.role !== "researcher" && user.role !== "admin")) return;
    const token = window.localStorage.getItem("token");
    if (!token) return;

    try {
      const { data } = await axios.get("/api/researcher/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rawList = Array.isArray(data?.notifications) ? data.notifications : [];
      let filtered = rawList;
      try {
        const rawRead = window.localStorage.getItem("researcherNotificationsReadIds");
        const readIds = new Set(JSON.parse(rawRead || "[]"));
        filtered = rawList.filter((item) => !readIds.has(item.id));
      } catch {
        filtered = rawList;
      }
      setNotificationCount(filtered.length);
      setNotifications(filtered);
      window.localStorage.setItem("researcherNotificationsCount", String(filtered.length));
      window.localStorage.setItem("researcherNotificationsList", JSON.stringify(filtered));
      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      if (error?.response?.status === 401) {
        navigate("/login");
      } else {
        // Keep the bell silent on fetch issues but avoid crashing the layout
        console.error("Failed to refresh researcher notifications", error);
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
      if (u.role !== "researcher" && u.role !== "admin" && u.role !== "reviewer") {
        navigate("/login");
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
    const id = window.setInterval(run, NOTIFICATIONS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [location.pathname, refreshNotifications, NOTIFICATIONS_REFRESH_MS]);

  useEffect(() => {
    const readNotifications = () => {
      try {
        const rawCount = window.localStorage.getItem("researcherNotificationsCount");
        const parsedCount = Number(rawCount);
        setNotificationCount(Number.isFinite(parsedCount) ? parsedCount : 0);

        const rawList = window.localStorage.getItem("researcherNotificationsList");
        const parsedList = JSON.parse(rawList || "[]");
        setNotifications(Array.isArray(parsedList) ? parsedList : []);
      } catch {
        setNotificationCount(0);
        setNotifications([]);
      }
    };

    readNotifications();
    const handleStorage = () => readNotifications();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const nav = useMemo(() => {
    const fullNav = [
      { to: "/researcher", label: "Dashboard" },
      { to: "/researcher/studies", label: "Studies" },
      { to: "/researcher/archived-studies", label: "Archived" },
      { to: "/researcher/artifacts", label: "Artifacts" },
      { to: "/researcher/assess", label: "Assess" },
      { to: "/researcher/competency-review", label: "Competency Review" },
      { to: "/researcher/reviewer", label: "Reviewer" },
      { to: "/researcher/study-creation-wizard", label: "Study Wizard" },
    ];
    if (user?.role === "reviewer") {
      return fullNav.filter((item) => item.to === "/researcher/reviewer");
    }
    return fullNav;
  }, [user?.role]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Study Weave ({user?.role === "reviewer" ? "Reviewer" : "Researcher"})
        </h1>
        <div className="flex items-center gap-3">
          <NotificationBell count={notificationCount} notifications={notifications} />
          <UserNav displayName={user?.name || "Researcher"} avatarUrl={avatarUrl} onLogout={handleLogout} />
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b pb-4">
        {nav.map((item) => (
          <Button
            key={item.to}
            asChild
            variant={
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                ? "secondary"
                : "ghost"
            }
            className="rounded-full"
          >
            <Link to={item.to}>{item.label}</Link>
          </Button>
        ))}
      </nav>

      <Outlet />
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
    window.localStorage.setItem("researcherNotificationsList", JSON.stringify(nextList));
    window.localStorage.setItem("researcherNotificationsCount", String(nextList.length));
    if (readIds) {
      window.localStorage.setItem("researcherNotificationsReadIds", JSON.stringify([...readIds]));
    }
    window.dispatchEvent(new Event("storage"));
  };

  const markNotifications = (ids = []) => {
    if (!ids.length) return;
    try {
      const rawRead = window.localStorage.getItem("researcherNotificationsReadIds");
      const readIds = new Set(JSON.parse(rawRead || "[]"));
      ids.forEach((id) => {
        if (id) readIds.add(id);
      });
      const remaining = notifications.filter((n) => !ids.includes(n.id));
      persistState(remaining, readIds);
    } catch {
      // Ignore storage errors
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification) return;
    markNotifications([notification.id]);
    navigateForNotification(notification);
  };

  const navigateForNotification = (notification) => {
    if (!notification) return;

    if (notification.type === "study_submission") {
      navigate("/researcher/reviewer", {
        state: {
          openEvaluationId: notification.evaluationId ? String(notification.evaluationId) : null,
          fallbackStudyId: notification.studyId ? String(notification.studyId) : null,
          participantId: notification.participantId ? String(notification.participantId) : null,
        },
      });
      return;
    }

    if (notification.type === "competency_complete") {
      navigate("/researcher/competency-review", {
        state: {
          openAssignmentId: notification.assignmentId ? String(notification.assignmentId) : null,
          participantId: notification.participantId ? String(notification.participantId) : null,
        },
      });
      return;
    }

    if (notification.type === "study_complete" && notification.studyId) {
      navigate("/researcher/studies", {
        state: { highlightStudyId: String(notification.studyId) },
      });
      return;
    }

    navigate("/researcher");
  };

  const handleMarkAll = () => {
    markNotifications(notifications.map((n) => n.id));
  };

  const labelForType = (type) => {
    switch (type) {
      case "study_submission":
        return "Study submission";
      case "study_complete":
        return "Study completed";
      case "competency_complete":
        return "Competency finished";
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
            <DropdownMenuItem className="text-sm text-muted-foreground">You're all caught up.</DropdownMenuItem>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="whitespace-normal text-sm cursor-pointer"
                onSelect={() => handleNotificationClick(n)}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{labelForType(n.type)}</span>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                  {n.studyTitle ? (
                    <span className="text-[11px] text-muted-foreground">{n.studyTitle}</span>
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

function UserNav({ displayName = "Researcher", avatarUrl = "", onLogout }) {
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
