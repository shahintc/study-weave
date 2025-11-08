import React, { useState, useEffect } from 'react';
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

// Reusing constants from UploadModal for consistency
const ALLOWED_FILE_TYPES = ['text/plain', 'image/png', 'application/pdf']; // Mime types for .txt, .png, .pdf

export function ManageModal({ isOpen, setIsOpen, artifact, onSave, onDelete, onFileReplace }) {
  const [editedName, setEditedName] = useState(artifact?.name || '');
  const [editedType, setEditedType] = useState(artifact?.type || '');
  const [editedTags, setEditedTags] = useState(artifact?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [error, setError] = useState('');

  // Available tags and types (should ideally come from a central source or API)
  const availableTags = [
    "diagram", "setup", "UX research", "code", "model", "analysis", "report",
    "findings", "qualitative", "data", "log", "generation",
  ];
  const availableTypes = ["human", "AI"];

  useEffect(() => {
    if (artifact) {
      setEditedName(artifact.name);
      setEditedType(artifact.type);
      setEditedTags(artifact.tags);
      setError('');
    }
  }, [artifact]);

  const handleSave = () => {
    if (!editedName.trim()) {
      setError("Artifact name cannot be empty.");
      return;
    }
    if (!editedType) {
      setError("Artifact type cannot be empty.");
      return;
    }

    const updatedArtifact = {
      ...artifact,
      name: editedName.trim(),
      type: editedType,
      tags: editedTags,
    };
    onSave(updatedArtifact);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${artifact.name}"?`)) {
      onDelete(artifact.id);
      setIsOpen(false);
    }
  };

  const handleTagAdd = () => {
    const tagToAdd = newTagInput.trim().toLowerCase();
    if (tagToAdd && !editedTags.includes(tagToAdd)) {
      setEditedTags((prevTags) => [...prevTags, tagToAdd]);
      setNewTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setEditedTags((prevTags) => prevTags.filter((tag) => tag !== tagToRemove));
  };

  // Placeholder for file replacement - will likely involve opening the UploadModal again
  const handleReplaceFile = () => {
    // This will eventually trigger the FileUploadModal or similar mechanism
    console.log("Initiating file replacement for artifact:", artifact.id);
    // You would typically call onFileReplace here, which would
    // trigger the FileUploadModal in the parent component
    if (onFileReplace) {
        onFileReplace(artifact.id);
    }
    setIsOpen(false); // Close manage modal
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
                  <DropdownMenuSeparator />
                  <div className="max-h-48 overflow-y-auto">
                    {availableTags
                      .filter((tag) => !editedTags.includes(tag)) // Only show unselected tags
                      .map((tag) => (
                        <DropdownMenuItem
                          key={tag}
                          onSelect={() => setEditedTags((prev) => [...prev, tag])}
                        >
                          {tag}
                        </DropdownMenuItem>
                      ))}
                  </div>
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
            <div className="col-span-3 flex items-center gap-2">
              <Input id="file" value={artifact?.fileName || "N/A"} readOnly className="flex-grow" />
              <Button variant="outline" onClick={handleReplaceFile} size="sm">
                Replace File
              </Button>
            </div>
          </div>

        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-start sm:items-center">
          <Button variant="destructive" onClick={handleDelete} className="order-2 sm:order-1 mt-2 sm:mt-0">
            Delete Artifact
          </Button>
          <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editedName.trim() || !editedType}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
