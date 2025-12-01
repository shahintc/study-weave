import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function StudyCreationSuccessDialog({ isOpen, onClose, study }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!study) {
    return null;
  }

  const publicUrl = `${window.location.origin}/study/public/${study.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCloseAndNavigate = () => {
    onClose();
    navigate("/researcher");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🎉 Study Created Successfully!</DialogTitle>
          <DialogDescription>
            Your new study "{study.title}" is ready. What would you like to do next?
          </DialogDescription>
        </DialogHeader>

        {study.isPublic && (
          <div className="space-y-3 py-4">
            <Label htmlFor="public-url" className="flex items-center gap-2 font-semibold"><Share2 className="h-4 w-4" /> Public Share Link</Label>
            <div className="flex items-center space-x-2">
              <Input id="public-url" value={publicUrl} readOnly />
              <Button type="button" size="sm" onClick={handleCopy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this link with guest participants. They won't need an account to contribute.</p>
          </div>
        )}

        <DialogFooter><Button onClick={handleCloseAndNavigate}>Go to Dashboard</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}