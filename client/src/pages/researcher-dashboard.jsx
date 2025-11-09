import React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Plus, LineChart, Settings2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ResearcherDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Load user from localStorage and guard route
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
        navigate("/participant-dashboard");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  // logout handled by layout header

  return (
    <div className="space-y-6">
      {/* Researcher Dashboard CTA */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Researcher Dashboard</CardTitle>
            <CardDescription>Welcome, {user?.name || "Researcher"} • {user?.email || ""}</CardDescription>
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
