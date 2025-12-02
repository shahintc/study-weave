import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { IconPlus, IconBolt } from "@tabler/icons-react";
// import { FileUploadModal } from '@/pages/artifactManagement/UploadModal'; // Import the FileUploadModal (for replacements) - No longer needed
import { DetailedUploadModal } from '@/pages/artifactManagement/DetailedUploadModal'; // Import the DetailedUploadModal (for new artifacts)
import { ManageModal } from '@/pages/artifactManagement/ManageModal'; // Import the ManageModal
import { GenerateArtifactModal } from "./GenerateArtifactModal";
import { CreateCollectionModal } from './CreateCollectionModal';
import { ViewCollectionModal } from './ViewCollectionModal';
import { Separator } from '@/components/ui/separator'; // Import Separator

export default function ResearcherDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const currentUserId = currentUser?.id || currentUser?.userId || null;

  const [currentView, setCurrentView] = useState('artifacts'); // 'artifacts' or 'collections'
  const [selectedType, setSelectedType] = useState(null); // Changed to single selection
  const [selectedTags, setSelectedTags] = useState([]);
  const [isNewArtifactModalOpen, setIsNewArtifactModalOpen] = useState(false);
  const [isGenerateArtifactModalOpen, setIsGenerateArtifactModalOpen] = useState(false); // State for the new generate artifact modal
  const [isReplaceUploadModalOpen, setIsReplaceUploadModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isCreateCollectionModalOpen, setIsCreateCollectionModalOpen] = useState(false);
  const [isViewCollectionModalOpen, setIsViewCollectionModalOpen] = useState(false); // New state for ViewCollectionModal
  const [collectionToViewId, setCollectionToViewId] = useState(null); // To track which collection is being viewed
  const [artifactToManage, setArtifactToManage] = useState(null);
  const [artifactToReplaceId, setArtifactToReplaceId] = useState(null); // To track which artifact's file is being replaced by the

  // State for fetched data
  const [availableTags, setAvailableTags] = useState([]);
  const [artifactsData, setArtifactsData] = useState([]);
  const [collectionsData, setCollectionsData] = useState([]); // New state for collections
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [loadingCollections, setLoadingCollections] = useState(true); // New state for collections loading
  const [errorTags, setErrorTags] = useState(null);
  const [errorArtifacts, setErrorArtifacts] = useState(null);
  const [errorCollections, setErrorCollections] = useState(null); // New state for collections error


  const availableTypes = ["human", "AI"];

  // Function to fetch artifacts
  const fetchArtifacts = useCallback(async () => {
    setLoadingArtifacts(true);
    setErrorArtifacts(null);
    if (!currentUserId) {
      setArtifactsData([]);
      setLoadingArtifacts(false);
      return;
    }
    try {
      const response = await api.get(`/api/artifacts/user/${currentUserId}`);
      setArtifactsData(response.data.artifacts);
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
  }, [currentUserId]);

  // Function to fetch artifact collections
  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true);
    setErrorCollections(null);
    if (!currentUserId) {
      setCollectionsData([]);
      setLoadingCollections(false);
      return;
    }
    try {
      const response = await api.get(`/api/artifact-collections/user/${currentUserId}`);
      setCollectionsData(response.data.collections);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // No collections found, which is a valid scenario
        setCollectionsData([]);
      } else {
        console.error("Error fetching collections:", error);
        setErrorCollections(error.message);
        setCollectionsData([]); // Clear collections on error
      }
    } finally {
      setLoadingCollections(false);
    }
  }, [currentUserId]);


  // Function to fetch available tags
  const fetchAvailableTags = useCallback(async () => {
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
  }, []);

  // useEffect to set the current user and check role on component mount
  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(rawUser);
      if (parsed.role !== "researcher") {
        navigate("/login");
        return;
      }
      setCurrentUser(parsed);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  // Effect to fetch available tags once (or when fetchAvailableTags itself changes, which it won't with empty deps)
  useEffect(() => {
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  // Effect to fetch artifacts when the view is 'artifacts' and currentUserId is available
  useEffect(() => {
    if (currentView === 'artifacts' && currentUserId) {
      fetchArtifacts();
    }
  }, [currentView, currentUserId, fetchArtifacts]);

  // Effect to fetch collections when the view is 'collections' and currentUserId is available
  useEffect(() => {
    if (currentView === 'collections' && currentUserId) {
      fetchCollections();
    }
  }, [currentView, currentUserId, fetchCollections]);

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

  const handleCollectionCreated = (newCollection) => {
    setIsCreateCollectionModalOpen(false);
    console.log("Collection created successfully. Refreshing collection list...", newCollection);
    fetchCollections(); // Refetch collections to include the new one
  };

  const handleCollectionUpdated = () => {
    console.log("Collection updated. Refreshing collection list...");
    fetchCollections(); // Refetch collections to reflect any changes
  };

  const handleCollectionDeleted = (deletedCollectionId) => {
    console.log("Collection deleted. Refreshing collection list...", deletedCollectionId);
    setCollectionToViewId(null); // Clear the viewed collection
    setIsViewCollectionModalOpen(false); // Close the view modal if open
    fetchCollections(); // Refetch collections to remove the deleted one
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
      <div className="flex justify-start gap-4 mb-6">
        <Button
          variant={currentView === 'artifacts' ? 'default' : 'outline'}
          onClick={() => setCurrentView('artifacts')}
        >
          My Artifacts
        </Button>
        <Button
          variant={currentView === 'collections' ? 'default' : 'outline'}
          onClick={() => setCurrentView('collections')}
        >
          My Collections
        </Button>
      </div>

      {currentView === 'artifacts' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">My Artifacts</h2>
            <div className="flex gap-2"> {/* New div to group buttons */}
              {/* Button to open FileUploadModal for new artifacts */}
              <Button
                onClick={() => {
                  setIsNewArtifactModalOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <IconPlus className="h-4 w-4" />
                Upload Artifact
              </Button>
              <Button
                onClick={() => {
                  setIsGenerateArtifactModalOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <IconBolt className="h-4 w-4" />
                Generate Artifact
              </Button>
              <Separator orientation="vertical" className="h-8 mx-2" /> {/* Separator */}
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
            {/* DetailedUploadModal for new artifacts */}
            <DetailedUploadModal
              isOpen={isNewArtifactModalOpen}
              setIsOpen={setIsNewArtifactModalOpen}
              artifactToReplaceId={null} // Always null for new artifacts
              onUploadSuccess={handleUploadSuccess}
              currentUserId={currentUserId}
            />
            {/* GenerateArtifactModal for generating new artifacts */}
            <GenerateArtifactModal
              isOpen={isGenerateArtifactModalOpen}
              setIsOpen={setIsGenerateArtifactModalOpen}
              onGenerateSuccess={handleUploadSuccess}
              currentUserId={currentUserId}
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




          {loadingArtifacts ? (
            <p>Loading artifacts...</p>
          ) : errorArtifacts ? (
            <p className="text-red-500">Error loading artifacts: {errorArtifacts}</p>
          ) : filteredArtifacts.length === 0 ? (
            <p>No artifacts found. Upload or generate one to get started!</p>
          ) : (
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
          )}
        </section>
      )}

      {currentView === 'collections' && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">My Collections</h2>
            <Button
              onClick={() => setIsCreateCollectionModalOpen(true)}
              className="flex items-center gap-2"
            >
              <IconPlus className="h-4 w-4" />
              Create Collection
            </Button>
          </div>

          {loadingCollections ? (
            <p>Loading collections...</p>
          ) : errorCollections ? (
            <p className="text-red-500">Error loading collections: {errorCollections}</p>
          ) : collectionsData.length === 0 ? (
            <p>No collections found. Create one to get started!</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collectionsData.map((collection) => (
                <Card key={collection.id}>
                  <CardHeader>
                    <CardTitle>{collection.name}</CardTitle>
                    <CardDescription>{collection.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>Artifacts in this collection: {collection.artifacts?.length || 0}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCollectionToViewId(collection.id);
                        setIsViewCollectionModalOpen(true);
                      }}
                    >
                      View Collection
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}


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
        currentUserId={currentUserId}
      />

      <CreateCollectionModal
        isOpen={isCreateCollectionModalOpen}
        setIsOpen={setIsCreateCollectionModalOpen}
        onCreateSuccess={handleCollectionCreated}
        currentUserId={currentUserId}
      />

      <ViewCollectionModal
        isOpen={isViewCollectionModalOpen}
        setIsOpen={setIsViewCollectionModalOpen}
        collectionId={collectionToViewId}
        currentUserId={currentUserId}
        onCollectionUpdated={handleCollectionUpdated}
        onCollectionDeleted={handleCollectionDeleted}
      />

    </div>
  );
}
