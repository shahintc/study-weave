import React, { useState, useEffect } from 'react';
import api from '@/api/axios';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function GenerateArtifactModal({ isOpen, setIsOpen, onGenerateSuccess }) {
  const [error, setError] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [topic, setTopic] = useState('');
  const [generatedArtifact, setGeneratedArtifact] = useState(null);
  const artifactType = "AI";
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // For the 'Looks good' action

  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [fetchedAvailableTags, setFetchedAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [errorFetchingTags, setErrorFetchingTags] = useState(null);

  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true);
      setErrorFetchingTags(null);
      try {
        const response = await api.get("/api/tags");
        setFetchedAvailableTags(response.data.tags.map(tag => tag.name));
      } catch (err) {
        console.error("Error fetching available tags:", err);
        setErrorFetchingTags("Failed to load available tags.");
        setFetchedAvailableTags([]);
      } finally {
        setLoadingTags(false);
      }
    };

    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!artifactName.trim() || !topic.trim()) {
      setError('Please fill out both name and topic fields.');
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedArtifact(null);

    const payload = {
      prompt: `Generate a single software artifact example regarding this: ${topic}`,
      key: "ARTIFACT_CREATION"
    };

    try {
      const response = await api.post('/api/llm', payload);

      const artifactArray = response.data.response;
      if (artifactArray && Array.isArray(artifactArray) && artifactArray.length > 0 && typeof artifactArray[0] === 'string') {
        setGeneratedArtifact(artifactArray[0]);
      } else {
        setError("Received an unexpected response format from the server.");
      }
    } catch (error) {
      console.error('Generation failed:', error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred.";
      setError(`Generation failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateArtifact = async () => {
    if (!generatedArtifact || !artifactName.trim()) {
      setError("Cannot save artifact without a name and generated content.");
      return;
    }

    setIsSaving(true);
    setError('');

    // Convert plaintext to a File object
    const blob = new Blob([generatedArtifact], { type: 'text/plain' });
    const file = new File([blob], `${artifactName.trim()}.txt`, { type: 'text/plain' });

    // Construct FormData to send as a multipart/form-data
    const formData = new FormData();
    formData.append('artifactFile', file);
    formData.append('name', artifactName);
    formData.append('tags', JSON.stringify(selectedTags));
    formData.append('type', artifactType);
    formData.append('userId', 1); // Placeholder for current user ID

    try {
      // POST to the same endpoint as DetailedUploadModal
      await api.post('/api/artifacts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onGenerateSuccess(); // Notify parent to refresh artifacts
      handleClose(); // Close and reset the modal

    } catch (error) {
      console.error('Artifact creation from generated text failed:', error);
      const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred.";
      setError(`Failed to save artifact: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError('');
    setArtifactName('');
    setTopic('');
    setSelectedTags([]);
    setIsLoading(false);
    setGeneratedArtifact(null);
    setIsSaving(false);
    setNewTagInput('');
    setFetchedAvailableTags([]);
    setLoadingTags(true);
    setErrorFetchingTags(null);
  };

  const handleTagAdd = async () => {
    const tagToAdd = newTagInput.trim().toLowerCase();
    if (tagToAdd && !selectedTags.includes(tagToAdd)) {
      try {
        const response = await api.post('/api/tags', { name: tagToAdd });
        setSelectedTags((prevTags) => [...prevTags, response.data.tag.name]);
        setNewTagInput('');
        if (!fetchedAvailableTags.includes(response.data.tag.name)) {
          setFetchedAvailableTags((prev) => [...prev, response.data.tag.name].sort());
        }
      } catch (err) {
        console.error("Error adding new tag:", err);
        setError(err.response?.data?.message || "Failed to add new tag.");
      }
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setSelectedTags((prevTags) => prevTags.filter((tag) => tag !== tagToRemove));
  };

  const isGenerateDisabled = !artifactName.trim() || !topic.trim() || isLoading || isSaving;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("sm:max-w-[480px] transition-all duration-300", generatedArtifact && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>Generate New Artifact</DialogTitle>
          <DialogDescription>
            Enter details to generate your artifact. Type will be "AI generated".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="artifactName" className="text-right">
              Name
            </Label>
            <Input
              id="artifactName"
              value={artifactName}
              onChange={(e) => setArtifactName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., My Generated Report"
              disabled={isLoading || isSaving}
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="artifactTags" className="text-right mt-2">
              Tags
            </Label>
            <div className="col-span-3 flex flex-wrap gap-2 items-center">
              {selectedTags.map((tag) => (
                <Badge key={tag} className="flex items-center gap-1">
                  {tag}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 rounded-full p-0"
                    onClick={() => handleTagRemove(tag)}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove tag</span>
                  </Button>
                </Badge>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isLoading || isSaving}>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add Tag
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]" align="end">
                  <DropdownMenuLabel>Add Tags</DropdownMenuLabel>
                  {loadingTags ? (
                    <div className="p-2">Loading tags...</div>
                  ) : errorFetchingTags ? (
                    <div className="p-2 text-destructive">{errorFetchingTags}</div>
                  ) : (
                    <>
                      <DropdownMenuSeparator />
                      <div className="max-h-48 overflow-y-auto">
                        {fetchedAvailableTags
                          .filter((tag) => !selectedTags.includes(tag))
                          .map((tag) => (
                            <DropdownMenuItem
                              key={tag}
                              onSelect={() => setSelectedTags((prev) => [...prev, tag])}
                            >
                              {tag}
                            </DropdownMenuItem>
                          ))}
                          {fetchedAvailableTags.filter((tag) => !selectedTags.includes(tag)).length === 0 && (
                            <div className="p-2">All available tags are selected.</div>
                          )}
                      </div>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Input
                      placeholder="New tag..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleTagAdd();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={handleTagAdd}
                      disabled={!newTagInput.trim()}
                    >
                      Create & Add
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="topic" className="text-right">
              Topic
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="col-span-3"
              placeholder="e.g., C++ quicksort implementation"
              disabled={isLoading}
            />
          </div>

          {generatedArtifact && (
            <>
              <Separator className="my-4" />
              <div className="grid w-full gap-2">
                <Label htmlFor="generated-artifact">Generated Artifact</Label>
                <Textarea
                  id="generated-artifact"
                  readOnly
                  value={generatedArtifact}
                  className="min-h-[150px]"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive mt-2 px-1">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading || isSaving}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerateDisabled}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </Button>
          {generatedArtifact && (
            <Button onClick={handleCreateArtifact} disabled={isLoading || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Looks good
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
