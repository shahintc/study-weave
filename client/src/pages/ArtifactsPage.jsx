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
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Plus, LineChart, Settings2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ResearcherDashboard() {
  const location = useLocation();
  const nav = [
    { to: "/researcher", label: "Dashboard" },
    { to: "/researcher/studies", label: "My Studies" },
    { to: "/artifacts", label: "Artifacts" },
    { to: "/researcher/assess", label: "Assess" },
  ];

  const [selectedTypes, setSelectedTypes] = React.useState([]);
  const [selectedTags, setSelectedTags] = React.useState([]);

  const availableTags = [
    "diagram",
    "setup",
    "UX research",
    "code",
    "model",
    "analysis",
    "report",
    "findings",
    "qualitative",
    "data",
    "log",
    "generation",
  ];
  const availableTypes = ["human", "AI"];

  const handleTypeChange = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleTagChange = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

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

      {/* Artifacts Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">My Artifacts</h2>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Upload new artifact
          </Button>
        </div>

        <div className="flex justify-end mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Filter
                {(selectedTypes.length > 0 || selectedTags.length > 0) && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    {selectedTypes.length + selectedTags.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>Filter Artifacts</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium">Type</DropdownMenuLabel>
              {availableTypes.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={() => handleTypeChange(type)}
                >
                  {type === "human" ? "Human generated" : "AI generated"}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuCheckboxItem
                checked={selectedTypes.length === 0}
                onCheckedChange={() => setSelectedTypes([])}
              >
                All Types
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />

              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium">Tags</DropdownMenuLabel>
              <div className="max-h-48 overflow-y-auto">
                {availableTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => handleTagChange(tag)}
                  >
                    {tag}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSelectedTags([])}>
                Clear Tags
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        </div>


        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              id: "1",
              name: "Experiment Setup Diagram",
              type: "human",
              tags: ["diagram", "setup", "UX research"],
            },
            {
              id: "2",
              name: "AI Model Codebase v1.2",
              type: "AI",
              tags: ["code", "model", "analysis"],
            },
            {
              id: "3",
              name: "User Study Report Q3 2023",
              type: "human",
              tags: ["report", "findings", "qualitative"],
            },
            {
              id: "4",
              name: "Synthetic Dataset Generation Log",
              type: "AI",
              tags: ["data", "log", "generation"],
            },
          ].map((artifact) => (
            <Card key={artifact.id}>
              <CardHeader>
                <CardTitle>{artifact.name}</CardTitle>
                <CardDescription>
                  Type: {artifact.type === "human" ? "Human" : "AI"} generated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {artifact.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button variant="outline" size="sm">Manage</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
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
