import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ResearcherLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

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
        <UserNav displayName={user?.name || "Researcher"} onLogout={handleLogout} />
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

