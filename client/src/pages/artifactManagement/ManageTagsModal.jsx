import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input component
import { IconPlus } from "@tabler/icons-react"; // Import IconPlus
import api from '@/api/axios';

export function ManageTagsModal({ isOpen, setIsOpen, onClose, currentUserId }) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newTagInput, setNewTagInput] = useState(''); // State for new tag input
  const [addingTag, setAddingTag] = useState(false); // State for loading during tag add

  useEffect(() => {
    if (isOpen) {
      const fetchTags = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await api.get("/api/tags");
          setTags(response.data.tags);
        } catch (err) {
          console.error("Error fetching tags for management:", err);
          setError(err.message || "Failed to fetch tags.");
          setTags([]);
        } finally {
          setLoading(false);
        }
      };
      fetchTags();
    }
  }, [isOpen]);

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/tags");
      setTags(response.data.tags);
    } catch (err) {
      console.error("Error fetching tags for management:", err);
      setError(err.message || "Failed to fetch tags.");
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTagAdd = async () => {
    const tagToAdd = newTagInput.trim();
    if (!tagToAdd) {
      setError("Tag name cannot be empty.");
      return;
    }
    if (tags.some(t => t.name.toLowerCase() === tagToAdd.toLowerCase())) {
      setError(`Tag '${tagToAdd}' already exists.`);
      return;
    }

    setAddingTag(true);
    setError(null); // Clear previous errors
    try {
      await api.post('/api/tags', { name: tagToAdd });
      setNewTagInput('');
      // Re-fetch tags to update the list
      await fetchTags();
    } catch (err) {
      console.error("Error adding new tag:", err);
      setError(err.response?.data?.message || "Failed to add new tag.");
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTag = async (tagId) => {
    setLoading(true); // Indicate loading while deleting
    setError(null); // Clear previous errors
    try {
      await api.delete(`/api/tags/${tagId}`);
      // Re-fetch tags to update the list after deletion
      await fetchTags();
    } catch (err) {
      console.error("Error deleting tag:", err);
      setError(err.response?.data?.message || "Failed to delete tag.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            This is where you will manage your artifact tags.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 px-4">
          {loading && !addingTag ? ( // Show general loading only if not adding a tag
            <p>Loading tags...</p>
          ) : error && !addingTag ? ( // Only show fetching error if not currently adding
            <p className="text-red-500">Error: {error}</p>
          ) : tags.length === 0 && !loading && !error ? (
            <p>No tags found.</p>
          ) : (
            <div>
              <h3 className="text-lg font-medium mb-2">Available Tags:</h3>
              <div className="max-h-48 overflow-y-auto pr-2">
                <ul className="space-y-2">
                  {tags.map((tag) => (
                    <li key={tag.id} className="flex justify-between items-center px-3 py-2 bg-muted rounded-md text-sm">
                      <span>{tag.name}</span>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteTag(tag.id)} disabled={loading || addingTag}>
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        {/* New section for adding tags */}
        <div className="px-4 pb-4 border-t pt-4">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="New tag name"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTagAdd();
                }
              }}
              disabled={addingTag || loading}
            />
            <Button
              onClick={handleTagAdd}
              disabled={addingTag || loading || !newTagInput.trim()}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              {addingTag ? "Adding..." : "Add New"}
            </Button>
          </div>
          {error && addingTag && <p className="text-red-500 text-sm mt-2">{error}</p>} {/* Show adding error here */}
        </div>
        <Button onClick={onClose} disabled={loading || addingTag}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}
