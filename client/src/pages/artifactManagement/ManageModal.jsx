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
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import { Plus } from 'lucide-react'; // Consider changing to IconPlus if @tabler/icons-react is preferred
import { IconEye } from '@tabler/icons-react'; // Import IconEye

// Reusing constants from UploadModal for consistency
import { cn } from '@/lib/utils'; // Assuming this utility is available in a shadcn project
import { ViewArtifactModal } from './ViewArtifactModal'; // Import ViewArtifactModal

const MAX_FILE_SIZE_MB = 10; // Match DetailedUploadModal
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['text/plain', 'image/png', 'application/pdf']; // Mime types for .txt, .png, .pdf

export function ManageModal({ isOpen, setIsOpen, artifact, onSave, onDelete, currentUserId }) {
  const [editedName, setEditedName] = useState(artifact?.name || '');
  const [editedType, setEditedType] = useState(artifact?.type || '');
  const [editedTags, setEditedTags] = useState(artifact?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isViewArtifactModalOpen, setIsViewArtifactModalOpen] = useState(false); // State for ViewArtifactModal

  // State for file replacement
  const [selectedFileForReplacement, setSelectedFileForReplacement] = useState(null);
  const [replacementError, setReplacementError] = useState('');
  const fileInputRef = React.useRef(null); // Ref for hidden file input

  const [fetchedAvailableTags, setFetchedAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [errorFetchingTags, setErrorFetchingTags] = useState(null);

  const availableTypes = ["human", "AI"]; // Matches backend ENUM

  useEffect(() => {
    if (artifact) {
      setEditedName(artifact.name);
      // Ensure the type matches backend enum values directly
      setEditedType(artifact.type === "Human generated" ? "human" : artifact.type === "AI generated" ? "AI" : artifact.type || '');
      // Ensure tags are an array of strings (extract names if they are objects)
      setEditedTags(artifact.tags ? artifact.tags.map(tag => tag.name || tag) : []);
      setError('');
      // Reset file replacement state when artifact or modal changes
      setSelectedFileForReplacement(null);
      setReplacementError('');
    }
  }, [artifact]);

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

    if (isOpen) { // Only fetch when modal is open
      fetchTags();
    }
  }, [isOpen]);

  const handleFileReplacementChange = React.useCallback((files) => {
    setReplacementError(''); // Clear previous errors
    if (!files || files.length === 0) {
      setSelectedFileForReplacement(null);
      return;
    }

    const file = files[0];

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setReplacementError(`Invalid file type. Only .txt, .png, and .pdf are allowed.`);
      setSelectedFileForReplacement(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setReplacementError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFileForReplacement(null);
      return;
    }

    setSelectedFileForReplacement(file);
  }, []);

  const handleSave = async () => {
    if (!editedName.trim()) {
      setError("Artifact name cannot be empty.");
      return;
    }
    if (!editedType) {
      setError("Artifact type cannot be empty.");
      return;
    }
    if (replacementError) { // Don't save if there's a file replacement error
        setError(replacementError);
        return;
    }

    setIsSaving(true);
    setError('');

    try {
      let response;
      if (selectedFileForReplacement) {
        // If a new file is selected, use FormData for multipart/form-data upload
        const formData = new FormData();
        formData.append('name', editedName.trim());
        formData.append('type', editedType);
        formData.append('tags', JSON.stringify(editedTags));
        formData.append('artifactFile', selectedFileForReplacement); // Multer field name

        response = await api.put(`/api/artifacts/${artifact.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data', // Important for file uploads
          },
        });
      } else {
        // No new file, send JSON payload
        const payload = {
          name: editedName.trim(),
          type: editedType,
          tags: JSON.stringify(editedTags), // Send tags as a JSON string
        };
        response = await api.put(`/api/artifacts/${artifact.id}`, payload);
      }

      onSave(response.data.artifact); // Pass the updated artifact back to parent
      setIsOpen(false);
    } catch (err) {
      console.error("Error saving artifact:", err);
      setError(err.response?.data?.message || "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${artifact.name}"?`)) {
      setIsDeleting(true);
      setError('');
      try {
        await api.delete(`/api/artifacts/${artifact.id}`);
        onDelete(artifact.id); // Notify parent of deletion
        setIsOpen(false);
      } catch (err) {
        console.error("Error deleting artifact:", err);
        setError(err.response?.data?.message || "Failed to delete artifact.");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTagAdd = async () => {
    const tagToAdd = newTagInput.trim().toLowerCase();
    if (tagToAdd && !editedTags.includes(tagToAdd)) {
      try {
        // Attempt to create the tag in the backend first (if it doesn't exist)
        // The backend's /api/tags POST endpoint uses findOrCreate
        const response = await api.post('/api/tags', { name: tagToAdd });
        // After successful "creation" (or finding), add to local state
        setEditedTags((prevTags) => [...prevTags, response.data.tag.name]);
        setNewTagInput('');
      } catch (err) {
        console.error("Error adding new tag:", err);
        setError(err.response?.data?.message || "Failed to add new tag.");
      }
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setEditedTags((prevTags) => prevTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] [&>button]:hidden"> {/* Hidden 'X' close button */}
        <DialogHeader>
          <DialogTitle>Manage Artifact: {artifact?.name}</DialogTitle>
          <DialogDescription>
            Edit the details of your artifact or delete it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              Type
            </Label>
            <Select onValueChange={setEditedType} value={editedType}>
              <SelectTrigger id="type" className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {/* Display user-friendly text, but send backend-friendly value */}
                    {type === "human" ? "Human generated" : "AI generated"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Tags</Label>
            <div className="col-span-3 flex flex-wrap gap-2 items-center">
              {editedTags.map((tag) => (
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
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add Tag
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]" align="end">
                  <DropdownMenuLabel>Add Tags</DropdownMenuLabel>
                  {loadingTags ? (
                    <div className="px-2 py-1.5 text-sm">Loading tags...</div>
                  ) : errorFetchingTags ? (
                    <div className="px-2 py-1.5 text-sm text-destructive">{errorFetchingTags}</div>
                  ) : (
                    <>
                      <DropdownMenuSeparator />
                      <div className="max-h-48 overflow-y-auto">
                        {fetchedAvailableTags
                          .filter((tag) => !editedTags.includes(tag)) // Only show unselected tags
                          .map((tag) => (
                            <DropdownMenuItem
                              key={tag}
                              onSelect={() => setEditedTags((prev) => [...prev, tag])}
                            >
                              {tag}
                            </DropdownMenuItem>
                          ))}
                          {fetchedAvailableTags.filter((tag) => !editedTags.includes(tag)).length === 0 && (
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

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="file" className="text-right">
              File
            </Label>
            <div className="col-span-3 flex flex-col gap-2"> {/* Changed to flex-col for file input/display */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer",
                  selectedFileForReplacement ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileReplacementChange(e.target.files)}
                  className="hidden"
                  accept=".txt,.png,.pdf" // Browser-level filter
                />
                {selectedFileForReplacement ? (
                  <p className="text-center text-sm text-foreground">
                    Selected: <span className="font-semibold">{selectedFileForReplacement.name}</span> ({(selectedFileForReplacement.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                ) : (
                  <>
                    <svg
                      className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      ></path>
                    </svg>
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                      Drag & drop new file, or <span className="text-primary cursor-pointer hover:underline">browse</span>
                    </p>
                  </>
                )}
              </div>
              {replacementError && <p className="text-sm text-destructive mt-1">{replacementError}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground mt-1">
                  Current file: <span className="font-semibold">{artifact?.fileOriginalName || "N/A"}</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewArtifactModalOpen(true)}
                  disabled={!artifact?.id || !artifact?.fileMimeType}
                >
                  <IconEye className="h-4 w-4 mr-1" />View
                </Button>
              </div>
            </div>
          </div>

        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-start sm:items-center">
          <Button variant="destructive" onClick={handleDelete} className="order-2 sm:order-1 mt-2 sm:mt-0" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Artifact'}
          </Button>
          <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving || isDeleting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editedName.trim() || !editedType || isSaving || !!replacementError}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
            <ViewArtifactModal
              isOpen={isViewArtifactModalOpen}
              setIsOpen={setIsViewArtifactModalOpen}
              artifactId={artifact?.id}
              artifactName={artifact?.name}
              fileMimeType={artifact?.fileMimeType}
              currentUserId={currentUserId} // Pass currentUserId
            />
      </DialogContent>
    </Dialog>
  );
}
