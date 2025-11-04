import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, LineChart, Settings2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ResearcherDashboard() {
  const location = useLocation();
  const nav = [
    { to: "/researcher", label: "Dashboard" },
    { to: "/researcher/studies", label: "My Studies" },
    { to: "/researcher/artifacts", label: "Artifacts" },
    { to: "/researcher/assess", label: "Assess" },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Study Weave (Researcher)</h1>
        <UserNav displayName="Dr. Ali" />
      </header>

      {/* Navbar */}
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

      {/* Researcher Dashboard CTA */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Researcher Dashboard</CardTitle>
            <CardDescription>Create and manage your studies</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Start a new participant study</p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New Study
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Active Studies */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My Active Studies</h2>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Study X: AI vs. Human Code Readability</CardTitle>
            <CardDescription>70% (14/20 participants)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">70%</span>
            </div>
            <Progress value={70} />
          </CardContent>
          <CardFooter className="justify-end">
            <Button size="sm">
              <LineChart className="mr-2 h-4 w-4" />
              Monitor
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Study Z: UML Diagram Clarity</CardTitle>
            <CardDescription className="text-amber-600">Draft • Setup incomplete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">Setup incomplete</span>
            </div>
            <Progress value={20} />
          </CardContent>
          <CardFooter className="justify-end">
            <Button size="sm" variant="outline">
              <Settings2 className="mr-2 h-4 w-4" />
              Edit Setup
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

export function UserNav({ displayName = "Researcher" }) {
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
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
