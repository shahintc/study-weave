import React, { useEffect, useState } from "react";
import api from '@/api/axios';
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
// import { FileUploadModal } from '@/pages/artifactManagement/UploadModal'; // Import the FileUploadModal (for replacements) - No longer needed
import { DetailedUploadModal } from '@/pages/artifactManagement/DetailedUploadModal'; // Import the DetailedUploadModal (for new artifacts)
import { ManageModal } from '@/pages/artifactManagement/ManageModal'; // Import the ManageModal

export default function ResearcherDashboard() {
  // Placeholder for current user ID. In a real app, this would come from auth context/state.
  const currentUserId = 1; // Assuming user with ID 1 exists for demonstration

  const [selectedType, setSelectedType] = useState(null); // Changed to single selection
  const [selectedTags, setSelectedTags] = useState([]);
  const [isNewArtifactModalOpen, setIsNewArtifactModalOpen] = useState(false);
  const [isReplaceUploadModalOpen, setIsReplaceUploadModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [artifactToManage, setArtifactToManage] = useState(null);
  const [artifactToReplaceId, setArtifactToReplaceId] = useState(null); // To track which artifact\'s file is being replaced by the

  // State for fetched data
  const [availableTags, setAvailableTags] = useState([]);
  const [artifactsData, setArtifactsData] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [errorTags, setErrorTags] = useState(null);
  const [errorArtifacts, setErrorArtifacts] = useState(null);


  const availableTypes = ["human", "AI"];

  // Function to fetch artifacts
  const fetchArtifacts = async () => {
    setLoadingArtifacts(true);
    setErrorArtifacts(null);
    try {
      const response = await api.get(`/api/artifacts/user/${currentUserId}`);
      console.log(response.data.artifacts)
      setArtifactsData(response.data.artifacts);
      console.log(artifactsData)
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // No artifacts found, which is a valid scenario
        setArtifactsData([]);
      } else {
        console.error("Error fetching artifacts:", error);
        setErrorArtifacts(error.message);
        setArtifactsData([]); // Clear artifacts on error
      }
    } finally {
      setLoadingArtifacts(false);
    }
  };

  // Function to fetch available tags
  const fetchAvailableTags = async () => {
    setLoadingTags(true);
    setErrorTags(null);
    try {
      const response = await api.get("/api/tags");
      // Extract just the names for the filter dropdown, or full objects if needed elsewhere
      setAvailableTags(response.data.tags.map(tag => tag.name));
    } catch (error) {
      console.error("Error fetching tags:", error);
      setErrorTags(error.message);
      setAvailableTags([]); // Clear tags on error
    } finally {
      setLoadingTags(false);
    }
  };

  // useEffect to fetch data on component mount
  useEffect(() => {
    fetchArtifacts();
    fetchAvailableTags();
  }, [currentUserId]); // Re-fetch if currentUserId changes

  const handleTypeChange = (type) => {
    setSelectedType((prev) => (prev === type ? null : type)); // Toggle selected type
  };

  const handleTagChange = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Placeholder for when a file is successfully uploaded (either new or replacement)
  const handleUploadSuccess = () => {
    setIsNewArtifactModalOpen(false);
    setIsReplaceUploadModalOpen(false);
    setArtifactToReplaceId(null); // Clear replacement context
    // Refetch artifacts after a successful upload/replacement
    console.log("File upload/replacement successful. Refreshing artifact list...");
    fetchArtifacts();
  };

  // Filtered artifacts based on selected types and tags
  const filteredArtifacts = artifactsData.filter(artifact => {
    const matchesType = selectedType === null || artifact.type === selectedType; // Check against single selectedType
    const matchesTags = selectedTags.length === 0 || selectedTags.every(selectedTag =>
      artifact.tags.some(artifactTag => artifactTag.name === selectedTag)
    );
    return matchesType && matchesTags;
  });

  return (
    <div className="space-y-6">
      {/* Artifacts Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">My Artifacts</h2>
          {/* Button to open FileUploadModal for new artifacts */}
          <Button
            onClick={() => {
              setIsNewArtifactModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <IconPlus className="h-4 w-4" />
            New Artifact
          </Button>
          {/* DetailedUploadModal for new artifacts */}
          <DetailedUploadModal
            isOpen={isNewArtifactModalOpen}
            setIsOpen={setIsNewArtifactModalOpen}
            artifactToReplaceId={null} // Always null for new artifacts
            onUploadSuccess={handleUploadSuccess}
          />

          {/* FileUploadModal for file replacements - This modal is no longer used directly, but the import remains for now */}
          {/*
          <FileUploadModal
            isOpen={isReplaceUploadModalOpen}
            setIsOpen={setIsReplaceUploadModalOpen}
            artifactToReplaceId={artifactToReplaceId} // Pass artifact ID for replacement
            onUploadSuccess={handleUploadSuccess}
          />
          */}
        </div>

        <div className="flex justify-end mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Filter
                {(selectedType !== null || selectedTags.length > 0) && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                    {(selectedType !== null ? 1 : 0) + selectedTags.length}
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
                  checked={selectedType === type}
                  onCheckedChange={() => handleTypeChange(type)}
                >
                  {type === "human" ? "Human generated" : "AI generated"}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuCheckboxItem
                checked={selectedType === null}
                onCheckedChange={() => setSelectedType(null)} // Set to null for "All Types"
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
          {filteredArtifacts.map((artifact) => (
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
                      key={tag.id}
                      className="px-2 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground"
                    >
                      {tag.name}
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
          setIsManageModalOpen(false);
          setArtifactToManage(null); // Clear artifact after saving
          fetchArtifacts(); // Refresh the artifact list
        }}
        onDelete={(artifactId) => {
          console.log("Deleted artifact with ID:", artifactId);
          setIsManageModalOpen(false);
          setArtifactToManage(null); // Clear artifact after deleting
          fetchArtifacts(); // Refresh the artifact list
        }}
      />

    </div>
  );
}
