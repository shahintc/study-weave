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
import { AlertTriangle, CheckCircle2 } from "lucide-react";


function Progress({ value = 0 }) {
  return (
    <div className="h-2 w-full rounded bg-muted">
      <div
        className="h-2 rounded bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function ParticipantDashboard() {
  const location = useLocation();
  const nav = [
    { to: "/participant", label: "Dashboard" },
    { to: "/studies", label: "Studies" },
    { to: "/history", label: "My History" },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Study Weave</h1>
        <UserNav />
      </header>

      {/* Simple navbar */}
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

      {/* Greeting */}
      <section>
        <h2 className="text-xl font-semibold">Welcome back, Zaeem!</h2>
      </section>

      {/* Notifications + Quick actions */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Recent activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
              <p>
                You have been invited to <span className="font-medium">“Study X”</span>.
                <span className="text-muted-foreground"> (Due Oct 30)</span>
              </p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              <p>Your “Study Y” submission was received.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump back into your work</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm">Start next task</Button>
            <Button size="sm" variant="outline">Browse studies</Button>
            <Button size="sm" variant="ghost">View history</Button>
          </CardContent>
        </Card>
      </section>

      {/* Assigned studies */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">My Assigned Studies</h2>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Study X: AI vs. Human Code Readability</CardTitle>
            <CardDescription>2 of 3 tasks complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">70%</span>
            </div>
            <Progress value={70} />
          </CardContent>
          <CardFooter className="justify-end">
            <Button size="sm">Start Task 3</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Study Y: UML Diagram Clarity</CardTitle>
            <CardDescription className="text-green-600">Completed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">100%</span>
            </div>
            <Progress value={100} />
          </CardContent>
          <CardFooter className="justify-end">
            <Button size="sm" variant="outline">View History</Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}

export function UserNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">John Doe</span>
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
