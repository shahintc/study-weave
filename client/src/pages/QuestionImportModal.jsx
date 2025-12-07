import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "../api/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Download } from "lucide-react";
import { saveAs } from "file-saver"; // We'll need to install this library

export function QuestionImportModal({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const handleImport = async () => {
    if (!file) {
      setError("Please select a CSV file to import.");
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("questionsFile", file);

    try {
      const response = await axios.post("/api/competency/assessments/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { questions, errors } = response.data;

      if (questions && questions.length > 0) {
        onImportSuccess(questions);
      }

      if (errors && errors.length > 0) {
        // If there are errors, display them and keep the modal open.
        setError(errors);
      } else {
        // Only close if the import was perfect.
        handleClose();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "An unexpected error occurred during import.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError("");
    setIsUploading(false);
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get("/api/competency/assessments/import-template", {
        responseType: "blob", // Important: tells axios to expect binary data
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, "question_template.csv");
    } catch (error) {
      console.error("Failed to download template:", error);
      // Display the error to the user in the modal
      setError("Could not download the template file. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Questions from CSV</DialogTitle>
          <DialogDescription>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>Upload a CSV with 'type', 'text', and 'is_correct' columns.</span>
              <Button
                type="button"
                variant="link"
                className="text-xs h-auto p-0 flex items-center gap-1"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3 w-3" />
                Download Template
              </Button>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="text-center"><FileText className="mx-auto h-10 w-10 text-primary" /><p className="mt-2 font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p></div>
            ) : (
              <div className="text-center text-muted-foreground"><UploadCloud className="mx-auto h-10 w-10" /><p className="mt-2">Drag & drop a CSV file here, or click to select</p></div>
            )}
          </div>
          {error && (
            <div className="mt-4">
              <h4 className="font-semibold text-destructive">Import Issues Found</h4>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                {Array.isArray(error) ? (
                  error.map((e, i) => (
                    <p key={i}>
                      <span className="font-semibold">Row {e.row}:</span> {e.message}
                    </p>
                  ))
                ) : (
                  <p>{error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleImport} disabled={!file || isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}