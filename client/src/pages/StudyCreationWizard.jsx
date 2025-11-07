import { useState } from "react"; // We must import this to use state
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // The "small tab" component
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

function StudyCreationWizard() {
  // --- 1. SET UP OUR STATE ---
  // A list to hold our criteria. We start with the two defaults.
  const [criteria, setCriteria] = useState([
    "Readability",
    "Correctness",
  ]);
  // A boolean to control if the dialog is open or closed
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // A string to hold the text of the new criterion as you type
  const [newCriterionText, setNewCriterionText] = useState("");

  // --- 2. A FUNCTION TO HANDLE SAVING ---
  const handleSaveCriterion = () => {
    if (newCriterionText.trim() === "") return; // Don't add empty text

    // Add the new criterion to our existing list
    setCriteria([...criteria, newCriterionText]);
    
    // Clear the input field and close the dialog
    setNewCriterionText("");
    setIsDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Study Creation Wizard</CardTitle>
          <CardDescription>
            Create New Study (Step 1 of 4: Details)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Study Title Section (no change) */}
          <div className="space-y-2">
            <Label htmlFor="study-title">Study Title</Label>
            <Input
              id="study-title"
              placeholder="AI vs. Human Code Readability"
            />
          </div>

          {/* Description Section (no change) */}
          <div className="space-y-2">
            <Label htmlFor="description">Description for Participants</Label>
            <Textarea
              id="description"
              placeholder="You will compare two code snippets..."
            />
          </div>

          {/* --- 3. UPDATED CRITERIA SECTION --- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Evaluation Criteria (What participants will rate)</Label>
              {/* This button now just opens the dialog */}
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
                Add New +
              </Button>
            </div>
            
            <div className="space-y-2 rounded-md border p-4">
              {/* We now dynamically map over our state to create the list */}
              {criteria.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>{item}</span>
                  {/* We could add an "X" button here later to remove items */}
                </div>
              ))}
            </div>
          </div>
          {/* --- END OF UPDATED SECTION --- */}

          {/* Settings Section (no change) */}
          <div className="space-y-2">
            <Label>Settings</Label>
            <div className="flex items-center space-x-2 rounded-md border p-4">
              <Checkbox id="blinded" />
              <Label htmlFor="blinded" className="font-normal">
                Blinded Evaluation (Hide artifact origin)
              </Label>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancel</Button>
          <Button>Next: Select Artifacts &gt;</Button>
        </CardFooter>
      </Card>

      {/* --- 4. THE DIALOG (MODAL) --- */}
      {/* This component is hidden until isDialogOpen is true */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Evaluation Criterion</DialogTitle>
            <DialogDescription>
              Enter the name for the new criterion. (e.g., "Completeness (1-5)")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="criterion-name" className="sr-only">
              Criterion Name
            </Label>
            <Input
              id="criterion-name"
              placeholder="e.g., Completeness (1-5 Stars)"
              value={newCriterionText}
              onChange={(e) => setNewCriterionText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCriterion}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StudyCreationWizard;