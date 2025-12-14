import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function StudyCreationSuccessDialog({ isOpen, onClose, study }) {
  const navigate = useNavigate();

  if (!study) {
    return null;
  }

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

        <DialogFooter><Button onClick={handleCloseAndNavigate}>Go to Dashboard</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
