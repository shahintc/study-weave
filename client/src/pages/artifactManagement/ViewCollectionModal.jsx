import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { IconPlus, IconBolt, IconX } from "@tabler/icons-react";
import api from '@/api/axios';
import { ManageModal } from '@/pages/artifactManagement/ManageModal';
import { DetailedUploadModal } from '@/pages/artifactManagement/DetailedUploadModal';
import { GenerateArtifactModal } from "./GenerateArtifactModal"; // Assuming this is also used for collections

export function ViewCollectionModal({ isOpen, setIsOpen, collectionId, currentUserId, onCollectionUpdated, onCollectionDeleted }) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [artifactToManage, setArtifactToManage] = useState(null);
  const [isNewArtifactModalOpen, setIsNewArtifactModalOpen] = useState(false); // For adding new artifact to collection
  const [isGenerateArtifactModalOpen, setIsGenerateArtifactModalOpen] = useState(false);

  // Filter states for artifacts within the collection
  const [selectedType, setSelectedType] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]); // Tags specific to artifacts in this collection

  const availableTypes = ["human", "AI"];

  const fetchCollectionDetails = useCallback(async () => {
    if (!collectionId || !currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/artifact-collections/${collectionId}?userId=${currentUserId}`);
      setCollection(response.data.collection);
      // Extract unique tags from artifacts in this collection
      const uniqueTags = [...new Set(response.data.collection.artifacts.flatMap(art => art.tags.map(tag => tag.name)))];
      setAvailableTags(uniqueTags);
    } catch (err) {
      console.error("Error fetching collection details:", err);
      setError(err.response?.data?.message || "Failed to load collection details.");
    } finally {
      setLoading(false);
    }
  }, [collectionId, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchCollectionDetails();
    } else {
      // Reset states when modal closes
      setCollection(null);
      setLoading(true);
      setError(null);
      setSelectedType(null);
      setSelectedTags([]);
      setAvailableTags([]);
    }
  }, [isOpen, fetchCollectionDetails]);

  const handleOpenChange = (open) => {
    setIsOpen(open);
  };

  const handleTypeChange = (type) => {
    setSelectedType((prev) => (prev === type ? null : type));
  };

  const handleTagChange = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleManageArtifact = (artifact) => {
    setArtifactToManage(artifact);
    setIsManageModalOpen(true);
  };

  const handleArtifactSave = (updatedArtifact) => {
    console.log("Updated artifact:", updatedArtifact);
    setIsManageModalOpen(false);
    setArtifactToManage(null);
    fetchCollectionDetails(); // Re-fetch collection to show updated artifact details
    if (onCollectionUpdated) onCollectionUpdated(); // Notify parent
  };

  const handleArtifactDelete = async (artifactId) => {
    console.log("Deleted artifact with ID:", artifactId);
    setIsManageModalOpen(false);
    setArtifactToManage(null);
    // After deleting an artifact, we also need to remove its association from this collection
    try {
        await api.delete(`/api/artifact-collections/${collectionId}/artifacts/${artifactId}`, { data: { userId: currentUserId } });
        fetchCollectionDetails(); // Re-fetch to update the collection's artifact list
        if (onCollectionUpdated) onCollectionUpdated(); // Notify parent
    } catch (err) {
        console.error("Error removing artifact from collection after deletion:", err);
        // Optionally show an error to the user
    }
  };

  const handleAddArtifactSuccess = () => {
    setIsNewArtifactModalOpen(false);
    setIsGenerateArtifactModalOpen(false);
    fetchCollectionDetails(); // Re-fetch collection to update its artifact list
    if (onCollectionUpdated) onCollectionUpdated(); // Notify parent
  };

  const handleRemoveArtifactFromCollection = async (artifactId) => {
    if (!collectionId || !currentUserId || !artifactId) return;

    if (window.confirm("Are you sure you want to remove this artifact from the collection? (The artifact itself will NOT be deleted)")) {
      try {
        await api.delete(`/api/artifact-collections/${collectionId}/artifacts/${artifactId}`, { data: { userId: currentUserId } });
        fetchCollectionDetails(); // Re-fetch to update the collection's artifact list
        if (onCollectionUpdated) onCollectionUpdated(); // Notify parent
      } catch (err) {
        console.error("Error removing artifact from collection:", err);
        setError(err.response?.data?.message || "Failed to remove artifact from collection.");
      }
    }
  };

  const handleDeleteCollection = async () => {
    if (!collectionId || !currentUserId) return;

    if (window.confirm("Are you sure you want to delete this collection? This action cannot be undone.")) {
      try {
        await api.delete(`/api/artifact-collections/${collectionId}`, { data: { userId: currentUserId } });
        setIsOpen(false);
        if (onCollectionDeleted) onCollectionDeleted(collectionId);
      } catch (err) {
        console.error("Error deleting collection:", err);
        setError(err.response?.data?.message || "Failed to delete collection.");
      }
    }
  };

  const filteredArtifacts = collection?.artifacts?.filter(artifact => {
    const matchesType = selectedType === null || artifact.type === selectedType;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(selectedTag =>
      artifact.tags.some(artifactTag => artifactTag.name === selectedTag)
    );
    return matchesType && matchesTags;
  }) || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{collection ? collection.name : "Collection Details"}</DialogTitle>
          <DialogDescription>
            {collection ? collection.description : "Loading collection details..."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p>Loading collection details...</p>
        ) : error ? (
          <p className="text-red-500">Error: {error}</p>
        ) : !collection ? (
          <p>Collection not found.</p>
        ) : (
          <div className="flex-grow overflow-y-auto space-y-4 py-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Artifacts in Collection ({collection.artifacts?.length || 0})</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsNewArtifactModalOpen(true)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <IconPlus className="h-4 w-4" />
                  Add New Artifact
                </Button>
                <Button
                  onClick={() => setIsGenerateArtifactModalOpen(true)}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <IconBolt className="h-4 w-4" />
                  Generate New Artifact
                </Button>
                {/* Potentially add a button here to add existing artifacts */}
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
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
                    onCheckedChange={() => setSelectedType(null)}
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
              {filteredArtifacts.length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground">No artifacts match your filters.</p>
              ) : (
                filteredArtifacts.map((artifact) => (
                  <Card key={artifact.id}>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        {artifact.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveArtifactFromCollection(artifact.id)}
                          className="w-6 h-6"
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Type: {artifact.type === "human" ? "Human" : "AI"} generated
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {artifact.tags?.map((tag) => (
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
                        onClick={() => handleManageArtifact(artifact)}
                      >
                        Manage
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between items-center mt-4">
          <Button variant="destructive" onClick={handleDeleteCollection} disabled={loading}>
            Delete Collection
          </Button>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Modals for managing artifacts within the collection */}
      <ManageModal
        isOpen={isManageModalOpen}
        setIsOpen={setIsManageModalOpen}
        artifact={artifactToManage}
        onSave={handleArtifactSave}
        onDelete={handleArtifactDelete}
      currentUserId={currentUserId}
    />
    <DetailedUploadModal
      isOpen={isNewArtifactModalOpen}
      setIsOpen={setIsNewArtifactModalOpen}
      artifactToReplaceId={null}
      onUploadSuccess={handleAddArtifactSuccess}
      currentUserId={currentUserId}
      collectionId={collectionId} // Pass collection ID to associate new artifact
    />
    <GenerateArtifactModal
      isOpen={isGenerateArtifactModalOpen}
      setIsOpen={setIsGenerateArtifactModalOpen}
      onGenerateSuccess={handleAddArtifactSuccess}
      currentUserId={currentUserId}
      collectionId={collectionId} // Pass collection ID to associate new artifact
    />
  </Dialog>
);
}