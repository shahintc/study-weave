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

export default function ParticipantLayout() {
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
      if (u.role !== "participant") {
        navigate("/researcher");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

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
    { to: "/participant", label: "Dashboard" },
    { to: "/participant/artifacts-comparison", label: "Artifacts Comparison" },
    { to: "/participant/competency", label: "Competency" },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Study Weave (Participant)</h1>
        <div className="flex items-center gap-3">
          <NotificationBell count={notificationCount} notifications={notifications} />
          <UserNav displayName={user?.name || "Participant"} onLogout={handleLogout} />
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b pb-4">
        {nav.map((item) => (
          <Button
            key={item.to}
            asChild
            variant={location.pathname === item.to ? "secondary" : "ghost"}
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
      const rawRead = window.localStorage.getItem("participantNotificationsReadIds");
      const readIds = new Set(JSON.parse(rawRead || "[]"));
      readIds.add(id);
      window.localStorage.setItem("participantNotificationsReadIds", JSON.stringify([...readIds]));

      const nextList = notifications.filter((n) => n.id !== id);
      window.localStorage.setItem("participantNotificationsList", JSON.stringify(nextList));
      window.localStorage.setItem("participantNotificationsCount", String(nextList.length));

      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore storage errors
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
            <DropdownMenuItem className="text-sm text-muted-foreground">
              You're all caught up.
            </DropdownMenuItem>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="whitespace-normal text-sm">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {n.type === "warning"
                        ? "⚠ Last day"
                        : n.type === "info"
                        ? "ℹ Reminder"
                        : n.type === "assignment"
                        ? "📄 New study"
                        : "Notification"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => markRead(n.id)}
                    >
                      Mark read
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-xs">{n.message}</span>
                  {n.studyId ? (
                    <span className="text-[11px] text-muted-foreground">Study #{n.studyId}</span>
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

function UserNav({ displayName = "Participant", onLogout }) {
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
