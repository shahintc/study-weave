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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Layers,
  FolderArchive,
  ClipboardList,
  Users,
  Sparkles,
  Wand2,
  Menu,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-none gap-6 px-4 py-6 lg:px-8">
        {/* Desktop left rail */}
        <aside className="hidden w-[240px] shrink-0 lg:block">
          <NavRail
            nav={nav}
            activePath={location.pathname}
            roleLabel={user?.role === "reviewer" ? "Reviewer" : "Researcher"}
            userName={user?.name}
          />
        </aside>

        {/* Mobile rail toggle */}
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
                roleLabel={user?.role === "reviewer" ? "Reviewer" : "Researcher"}
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
                    {user?.role === "reviewer" ? "Reviewer" : "Researcher"} workspace
                  </span>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">
                      Study Weave
                    </h1>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Live
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
                  <Link to="/researcher/study-creation-wizard">
                    <Sparkles className="h-4 w-4" />
                    New study
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" className="hidden sm:inline-flex" asChild>
                  <Link to="/researcher/participants-list">
                    <Users className="h-4 w-4" />
                    Invite
                  </Link>
                </Button>
                <NotificationBell count={notificationCount} notifications={notifications} />
                <UserNav displayName={user?.name || "Researcher"} avatarUrl={avatarUrl} onLogout={handleLogout} />
              </div>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
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

function NavRail({ nav = [], activePath = "", roleLabel = "Researcher", userName = "", dense = false }) {
  const iconMap = {
    "/researcher": LayoutDashboard,
    "/researcher/studies": Layers,
    "/researcher/archived-studies": FolderArchive,
    "/researcher/artifacts": ClipboardList,
    "/researcher/assess": Wand2,
    "/researcher/competency-review": Users,
    "/researcher/reviewer": Sparkles,
    "/researcher/study-creation-wizard": Layers,
    "/researcher/participants-list": Users,
  };

  const itemBase = "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

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
            <Link
              key={item.to}
              to={item.to}
              className={`${itemBase} ${isActive ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/60 text-foreground">
                <Icon className="h-5 w-5" />
                {isActive ? (
                  <span className="absolute inset-y-1 -left-2 w-1 rounded-full bg-primary/90" />
                ) : null}
              </span>
              <div className="flex flex-col">
                <span>{item.label}</span>
                {item.subLabel ? (
                  <span className="text-xs text-muted-foreground">{item.subLabel}</span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
