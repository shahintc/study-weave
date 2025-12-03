import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
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
  const [user, setUser] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      const u = JSON.parse(raw);
      setUser(u);
      if (u.role !== "researcher") {
        navigate("/participant");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const readNotifications = () => {
      try {
        const rawCount = window.localStorage.getItem("researcherNotificationsCount");
        const parsedCount = Number(rawCount);
        setNotificationCount(Number.isFinite(parsedCount) ? parsedCount : 0);

        const rawList = window.localStorage.getItem("researcherNotificationsList");
        const parsedList = JSON.parse(rawList || "[]");
        setNotifications(Array.isArray(parsedList) ? parsedList : []);
      } catch (error) {
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

  const nav = [
    { to: "/researcher", label: "Dashboard" },
    { to: "/researcher/studies", label: "Studies" },
    { to: "/researcher/archived-studies", label: "Archived" },
    { to: "/researcher/artifacts", label: "Artifacts" },
    { to: "/researcher/assess", label: "Assess" },
    { to: "/researcher/competency-review", label: "Competency Review" },
    { to: "/researcher/reviewer", label: "Reviewer" },
    { to: "/researcher/study-creation-wizard", label: "Study Wizard" },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Study Weave (Researcher)</h1>
        <div className="flex items-center gap-3">
          <NotificationBell count={notificationCount} notifications={notifications} />
          <UserNav displayName={user?.name || "Researcher"} onLogout={handleLogout} />
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

function NotificationBell({ count = 0, notifications = [] }) {
  const markRead = (id) => {
    if (!id) return;
    try {
      const rawRead = window.localStorage.getItem("researcherNotificationsReadIds");
      const readIds = new Set(JSON.parse(rawRead || "[]"));
      readIds.add(id);
      window.localStorage.setItem("researcherNotificationsReadIds", JSON.stringify([...readIds]));

      const nextList = notifications.filter((n) => n.id !== id);
      window.localStorage.setItem("researcherNotificationsList", JSON.stringify(nextList));
      window.localStorage.setItem("researcherNotificationsCount", String(nextList.length));

      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      // Ignore storage errors; UI will refresh on next fetch
    }
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
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <DropdownMenuItem className="text-sm text-muted-foreground">You're all caught up.</DropdownMenuItem>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="whitespace-normal text-sm">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{labelForType(n.type)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </Button>
                  </div>
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

function UserNav({ displayName = "Researcher", onLogout }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
            <AvatarFallback>{displayName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

