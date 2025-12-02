import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IconX } from '@tabler/icons-react';
import api from '@/api/axios'; // Assuming you have an axios instance configured

export function ViewArtifactModal({ isOpen, setIsOpen, artifactId, artifactName, fileMimeType, currentUserId }) {
  const [fileContent, setFileContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchArtifactContent = useCallback(async () => {
    if (!artifactId || !currentUserId) {
      setError("Artifact ID or User ID not available.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFileContent(null);

    try {
      const response = await api.get(`/api/artifacts/${artifactId}/content`, {
        // Set responseType based on mime type for better handling,
        // though for image/pdf, browser might handle it via iframe src
        responseType: fileMimeType.startsWith('image/') || fileMimeType === 'application/pdf' ? 'blob' : 'text',
      });

      if (fileMimeType.startsWith('image/') || fileMimeType === 'application/pdf') {
        // For images and PDFs, create a Blob URL
        const blob = new Blob([response.data], { type: fileMimeType });
        setFileContent(URL.createObjectURL(blob));
      } else {
        // For text-based files
        setFileContent(response.data);
      }
    } catch (err) {
      console.error("Error fetching artifact content:", err);
      setError(err.response?.data?.message || "Failed to load artifact content.");
    } finally {
      setLoading(false);
    }
  }, [artifactId, fileMimeType, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchArtifactContent();
    } else {
      // Clean up on modal close
      if (fileContent && (fileMimeType.startsWith('image/') || fileMimeType === 'application/pdf')) {
        URL.revokeObjectURL(fileContent); // Revoke Blob URL to prevent memory leaks
      }
      setFileContent(null);
      setLoading(true);
      setError(null);
    }
  }, [isOpen, fetchArtifactContent, fileMimeType]);

  const renderContent = () => {
    if (loading) {
      return <p className="text-center">Loading preview...</p>;
    }
    if (error) {
      return <p className="text-center text-red-500">Error: {error}</p>;
    }
    if (!fileContent) {
      return <p className="text-center text-muted-foreground">No content to display.</p>;
    }

    // Determine how to render based on MIME type
    if (fileMimeType.startsWith('image/')) {
      return (
        <img
          src={fileContent}
          alt={artifactName || "Artifact Preview"}
          className="max-w-full h-auto max-h-[70vh] object-contain mx-auto"
        />
      );
    } else if (fileMimeType === 'application/pdf') {
      return (
        <iframe
          src={fileContent}
          title={artifactName || "PDF Preview"}
          width="100%"
          height="500px"
          className="border-none"
        >
          This browser does not support PDFs. Please download the file to view it.
        </iframe>
      );
    } else if (fileMimeType === 'text/plain') {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm p-2 bg-gray-100 dark:bg-gray-800 rounded-md max-h-[70vh] overflow-auto">
          {fileContent}
        </pre>
      );
    } else {
      return (
        <p className="text-center text-muted-foreground">
          File type not directly previewable. Please download to view.
        </p>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>View Artifact: {artifactName || "Loading..."}</DialogTitle>
          <DialogDescription>
            Previewing content for: <span className="font-semibold">{artifactName || "N/A"}</span> ({fileMimeType || "N/A"})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto py-2">
          {renderContent()}
        </div>

        <DialogFooter className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            <IconX className="h-4 w-4 mr-2" /> Close
          </Button>
          {fileContent && (
            <Button asChild>
              {fileMimeType.startsWith('image/') || fileMimeType === 'application/pdf' ? (
                <a href={fileContent} download={artifactName}>Download</a>
              ) : fileMimeType === 'text/plain' ? (
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(fileContent)}`}
                  download={`${artifactName}.txt`}
                >
                  Download
                </a>
              ) : (
                <a href={`/api/artifacts/${artifactId}/content`} download={artifactName}>Download</a>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}