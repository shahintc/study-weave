import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils'; // Assuming this utility is available in a shadcn project

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['text/plain', 'image/png', 'application/pdf']; // Mime types for .txt, .png, .pdf

export function FileUploadModal({ isOpen, setIsOpen, artifactToReplaceId, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
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
  }, []);

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

  const handleUpload = () => {
    if (selectedFile) {
      console.log(
        `Uploading file for ${artifactToReplaceId ? 'replacement of artifact' + artifactToReplaceId : 'new artifact'}:`,
        selectedFile.name,
        selectedFile
      );
      // In a real application, you would send selectedFile to a server here.
      // You would also send artifactToReplaceId if it's a file replacement.
      // Example:
      // const formData = new FormData();
      // formData.append('file', selectedFile);
      // if (artifactToReplaceId) {
      //   formData.append('artifactId', artifactToReplaceId);
      // }
      // fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData,
      // }).then(response => {
      //   // handle response
      //   onUploadSuccess(); // Call success callback after successful upload
      // }).catch(error => {
      //   // handle error
      //   setError('Upload failed: ' + error.message);
      // });

      // For demonstration purposes, just clear state and call success callback
      setSelectedFile(null);
      setError('');
      setIsDragOver(false); // Reset drag state
      onUploadSuccess(); // Notify parent of success

      // Optionally, use a toast notification for success
      // import { useToast } from '@/components/ui/use-toast';
      // const { toast } = useToast();
      // toast({ title: "Upload successful", description: `${selectedFile.name} uploaded.` });
    } else {
      setError('Please select a file to upload.');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedFile(null);
    setError('');
    setIsDragOver(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Drag and drop your file here, or click to browse. Max {MAX_FILE_SIZE_MB}MB.
            Allowed types: .txt, .png, .pdf.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || !!error}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
