import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils'; // For conditional class names
import api from '@/api/axios';

export function SelectArtifactModal({ isOpen, setIsOpen, onClose, currentUserId, collectionId, existingArtifactIdsInCollection = [] }) {
  const [allUserArtifacts, setAllUserArtifacts] = useState([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [errorArtifacts, setErrorArtifacts] = useState(null);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState(new Set());
  const [addingToCollection, setAddingToCollection] = useState(false);

  const fetchUserArtifacts = useCallback(async () => {
    setLoadingArtifacts(true);
    setErrorArtifacts(null);
    if (!currentUserId) {
      setAllUserArtifacts([]);
      setLoadingArtifacts(false);
      return;
    }
    try {
      const response = await api.get(`/api/artifacts/user/${currentUserId}`);
      setAllUserArtifacts(response.data.artifacts);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setAllUserArtifacts([]);
      } else {
        console.error("Error fetching user artifacts for selection:", error);
        setErrorArtifacts(error.message || "Failed to fetch artifacts.");
        setAllUserArtifacts([]);
      }
    } finally {
      setLoadingArtifacts(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchUserArtifacts();
      setSelectedArtifactIds(new Set()); // Reset selection when modal opens
    }
  }, [isOpen, fetchUserArtifacts]);

  const availableArtifacts = allUserArtifacts.filter(
    artifact => !existingArtifactIdsInCollection.includes(artifact.id)
  );

  const handleArtifactSelect = (artifactId) => {
    setSelectedArtifactIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(artifactId)) {
        newSelected.delete(artifactId);
      } else {
        newSelected.add(artifactId);
      }
      return newSelected;
    });
  };

  const handleAddSelectedArtifacts = async () => {
    if (selectedArtifactIds.size === 0 || !collectionId || !currentUserId) return;

    setAddingToCollection(true);
    setErrorArtifacts(null);
    try {
      await api.post(`/api/artifact-collections/${collectionId}/artifacts`, {
        artifactIds: Array.from(selectedArtifactIds),
        userId: currentUserId,
      });
      onClose(); // Close modal and trigger refresh in parent
    } catch (error) {
      console.error("Error adding artifacts to collection:", error);
      setErrorArtifacts(error.response?.data?.message || "Failed to add artifacts to collection.");
    } finally {
      setAddingToCollection(false);
    }
  };

  const isAddButtonDisabled = selectedArtifactIds.size === 0 || loadingArtifacts || addingToCollection;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[700px] md:max-w-[900px] lg:max-w-[1100px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Artifacts to Add</DialogTitle>
          <DialogDescription>
            Choose existing artifacts to add to this collection.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex-grow overflow-y-auto px-4">
          {loadingArtifacts ? (
            <p>Loading artifacts...</p>
          ) : errorArtifacts ? (
            <p className="text-red-500">Error: {errorArtifacts}</p>
          ) : availableArtifacts.length === 0 ? (
            <p>No other artifacts found to add to this collection.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableArtifacts.map((artifact) => (
                <Card
                  key={artifact.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    selectedArtifactIds.has(artifact.id) ? "ring-2 ring-offset-2 ring-blue-500" : "hover:border-gray-300"
                  )}
                  onClick={() => handleArtifactSelect(artifact.id)}
                >
                  <CardHeader>
                    <CardTitle>{artifact.name}</CardTitle>
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
                </Card>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between items-center mt-4 px-4">
          <Button variant="outline" onClick={onClose} disabled={addingToCollection}>
            Cancel
          </Button>
          <Button onClick={handleAddSelectedArtifacts} disabled={isAddButtonDisabled}>
            {addingToCollection ? "Adding..." : `Add Selected Artifacts (${selectedArtifactIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}