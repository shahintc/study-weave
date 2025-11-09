import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { IconPlus } from "@tabler/icons-react";
import { FileUploadModal } from '@/pages/artifactManagement/UploadModal'; // Import the FileUploadModal
import { ManageModal } from '@/pages/artifactManagement/ManageModal'; // Import the ManageModal

export default function ResearcherDashboard() {
  const [selectedTypes, setSelectedTypes] = React.useState([]);
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = React.useState(false);
  const [artifactToManage, setArtifactToManage] = React.useState(null);
  const [artifactToReplaceId, setArtifactToReplaceId] = React.useState(null); // To track which artifact's file is being replaced


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

  // Reorganized placeholder artifact data
  const artifactsData = [
    {
      id: "1",
      name: "Experiment Setup Diagram",
      type: "human",
      tags: ["diagram", "setup", "UX research"],
      fileName: "experiment-diagram.pdf", // Added for ManageModal display
    },
    {
      id: "2",
      name: "AI Model Codebase v1.2",
      type: "AI",
      tags: ["code", "model", "analysis"],
      fileName: "ai-model-v1.2.zip", // Added for ManageModal display
    },
    {
      id: "3",
      name: "User Study Report Q3 2023",
      type: "human",
      tags: ["report", "findings", "qualitative"],
      fileName: "user-study-report.pdf", // Added for ManageModal display
    },
    {
      id: "4",
      name: "Synthetic Dataset Generation Log",
      type: "AI",
      tags: ["data", "log", "generation"],
      fileName: "synth-data-log.txt", // Added for ManageModal display
    },
  ];

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

  // Placeholder for when a file is successfully uploaded (either new or replacement)
  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    setArtifactToReplaceId(null); // Clear replacement context
    // In a real application, you would typically refetch your artifacts data here
    // For demonstration, we'll just log
    console.log("File upload/replacement successful. Refreshing artifact list would happen here.");
  };

  return (
    <div className="space-y-6">
      {/* Artifacts Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">My Artifacts</h2>
          {/* Button to open FileUploadModal for new artifacts */}
          <Button
            onClick={() => {
              setArtifactToReplaceId(null); // Ensure no replacement context for new upload
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <IconPlus className="h-4 w-4" />
            New Artifact
          </Button>
          <FileUploadModal
            isOpen={isUploadModalOpen}
            setIsOpen={setIsUploadModalOpen}
            artifactToReplaceId={artifactToReplaceId} // Pass null for new uploads, or ID for replacement
            onUploadSuccess={handleUploadSuccess}
          />
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
          {artifactsData.map((artifact) => (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setArtifactToManage(artifact);
                    setIsManageModalOpen(true);
                  }}
                >
                  Manage
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* Manage Modal */}
      <ManageModal
        isOpen={isManageModalOpen}
        setIsOpen={setIsManageModalOpen}
        artifact={artifactToManage}
        onSave={(updatedArtifact) => {
          console.log("Updated artifact:", updatedArtifact);
          // In a real application, you would send updatedArtifact to your backend
          // and then update the local 'artifactsData' state or refetch data.
          setIsManageModalOpen(false);
          setArtifactToManage(null); // Clear artifact after saving
        }}
        onDelete={(artifactId) => {
          console.log("Deleted artifact with ID:", artifactId);
          // In a real application, send delete request to your backend
          // and then update the local 'artifactsData' state or refetch data.
          setIsManageModalOpen(false);
          setArtifactToManage(null); // Clear artifact after deleting
        }}
        onFileReplace={(artifactId) => {
          // This function is called from ManageModal when "Replace File" is clicked
          setIsManageModalOpen(false); // Close the Manage Modal first
          setArtifactToReplaceId(artifactId); // Set the ID of the artifact whose file is being replaced
          setIsUploadModalOpen(true); // Open the FileUploadModal
        }}
      />

    </div>
  );
}
