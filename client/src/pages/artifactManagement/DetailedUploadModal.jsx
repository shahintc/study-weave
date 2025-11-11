import React, { useState, useCallback, useRef } from 'react';
import api from '@/api/axios'; // Import the axios instance
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils'; // Assuming this utility is available in a shadcn project

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['text/plain', 'image/png', 'application/pdf']; // Mime types for .txt, .png, .pdf

// const API_BASE_URL = 'http://localhost:5200'; // Backend URL - No longer needed with Axios instance

export function DetailedUploadModal({ isOpen, setIsOpen, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [artifactTags, setArtifactTags] = useState(''); // Assuming comma-separated tags for now
  const [artifactType, setArtifactType] = useState(''); // "AI" or "human"
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const fileInputRef = useRef(null);

  const handleFileChange = useCallback((files) => {
    setError(''); // Clear previous errors
    if (!files || files.length === 0) {
      setSelectedFile(null);
      return;
    }

    const file = files[0];

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError(`Invalid file type. Only .txt, .png, and .pdf are allowed.`);
      setSelectedFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Optionally pre-fill artifact name from file name, without extension, only if currently empty
    if (!artifactName.trim()) {
      setArtifactName(file.name.split('.').slice(0, -1).join('.') || '');
      }
    }, [artifactName]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    handleFileChange(event.dataTransfer.files);
  }, [handleFileChange]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }
    if (!artifactName.trim()) {
      setError('Please enter a name for the artifact.');
      return;
    }
    // Corrected the type values to match backend ENUM 'AI' | 'human'
    if (!artifactType || (artifactType !== 'AI' && artifactType !== 'human')) {
      setError('Please select a valid artifact type.');
      return;
    }

    // Placeholder for current user ID. In a real app, this would come from auth context/state.
    const currentUserId = 1;

    setIsLoading(true); // Start loading
    setError(''); // Clear previous errors

    const formData = new FormData();
    formData.append('artifactFile', selectedFile); // 'artifactFile' must match the Multer field name in the backend
    formData.append('name', artifactName);
    // Backend expects tags as a JSON string for easy parsing
    formData.append('tags', JSON.stringify(artifactTags.split(',').map(tag => tag.trim()).filter(tag => tag)));
    formData.append('type', artifactType);
    formData.append('userId', currentUserId); // Attach the user ID

    try {
      const response = await api.post('/api/artifacts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data', // Important for file uploads with FormData
        },
      });

      console.log('Artifact uploaded successfully:', response.data);

      // Clear state and call success callback
      setSelectedFile(null);
      setIsDragOver(false);
      setArtifactName('');
      setArtifactTags('');
      setArtifactType('');
      onUploadSuccess(); // Notify parent of success

    } catch (error) {
      console.error('Upload failed:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError('Upload failed: ' + (error.response.data.message || error.message));
      } else if (error.request) {
        // The request was made but no response was received
        setError('Upload failed: No response from server.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError('Upload failed: ' + error.message);
      }
    } finally {
      setIsLoading(false); // End loading
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedFile(null);
    setError('');
    setIsDragOver(false);
    setArtifactName('');
    setArtifactTags('');
    setArtifactType('');
    setIsLoading(false); // Reset loading state on close
  };

  const isUploadDisabled = !selectedFile || !!error || !artifactName.trim() || !artifactType || isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Upload Detailed Artifact</DialogTitle>
          <DialogDescription>
            Provide details for your artifact and upload the file. Max {MAX_FILE_SIZE_MB}MB.
            Allowed types: .txt, .png, .pdf.
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
              placeholder="e.g., My Project Report"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="artifactTags" className="text-right">
              Tags
            </Label>
            <Input
              id="artifactTags"
              value={artifactTags}
              onChange={(e) => setArtifactTags(e.target.value)}
              className="col-span-3"
              placeholder="e.g., project, report, analysis (comma-separated)"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="artifactType" className="text-right">
              Type
            </Label>
            <Select onValueChange={setArtifactType} value={artifactType}>
              <SelectTrigger id="artifactType" className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {/* Corrected values to match backend ENUM 'AI' | 'human' */}
                <SelectItem value="AI">AI generated</SelectItem>
                <SelectItem value="human">Human generated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(
              "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors duration-200 cursor-pointer",
              isDragOver ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleBrowseClick}
          >
            <input // Using a plain input for file type, hidden
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
              accept=".txt,.png,.pdf" // Browser-level filter
            />
            {selectedFile ? (
              <p className="text-center text-sm text-foreground">
                Selected: <span className="font-semibold">{selectedFile.name}</span> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            ) : (
              <>
                <svg
                  className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2"
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
                  Drag and drop file here, or <span className="text-primary cursor-pointer hover:underline">browse</span>
                </p>
              </>
            )}
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploadDisabled}>
            {isLoading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}