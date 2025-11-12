import { useState } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import for navigation
import axios from '../api/axios'; // 2. Import your team's "waiter" (like you said!)
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

function StudyCreationWizard() {
  const navigate = useNavigate(); // For going to the next page

  // --- 1. SET UP *ALL* OUR STATE ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isBlinded, setIsBlinded] = useState(false);
  const [criteria, setCriteria] = useState([
    "Readability",
    "Correctness",
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCriterionText, setNewCriterionText] = useState("");
  const [error, setError] = useState(null); // To show any save errors

  // --- 2. FUNCTION TO ADD NEW CRITERIA (Your old code, no change) ---
  const handleSaveCriterion = () => {
    if (newCriterionText.trim() === "") return;
    setCriteria([...criteria, newCriterionText]);
    setNewCriterionText("");
    setIsDialogOpen(false);
  };

  // --- 3. NEW FUNCTION TO SAVE THE STUDY! ---
  const handleCreateStudy = async () => {
    setError(null); // Clear any old errors

    // 1. Bundle up our data
    const studyData = {
      title: title,
      description: description,
      criteria: criteria, // Your backend will save this JSON
      isBlinded: isBlinded,
    };

    try {
      // 2. Send the "order" to the "kitchen"
      // This calls your new 'POST /api/studies' endpoint!
      // (axios automatically adds the /api/studies part)
      const response = await axios.post('/api/studies', studyData);

      // 3. Success!
      const newStudy = response.data;
      console.log('Study created successfully:', newStudy);

      // 4. Go to the next step of the wizard (we'll make a fake route for now)
      // We can pass the new study's ID to the next page
      // navigate(`/researcher/study/${newStudy.id}/select-artifacts`);
      alert("Study Created Successfully! (ID: " + newStudy.id + "). We can now go to the next page.");


    } catch (err) {
      console.error('Failed to create study:', err);
      setError("Failed to create study. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Study Creation Wizard</CardTitle>
          <CardDescription>
            Create New Study (Step 1 of 4: Details)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* --- 4. CONNECT THE INPUTS TO STATE --- */}
          <div className="space-y-2">
            <Label htmlFor="study-title">Study Title</Label>
            <Input
              id="study-title"
              placeholder="AI vs. Human Code Readability"
              value={title} // Connect to state
              onChange={(e) => setTitle(e.target.value)} // Update state
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description for Participants</Label>
            <Textarea
              id="description"
              placeholder="You will compare two code snippets..."
              value={description} // Connect to state
              onChange={(e) => setDescription(e.target.value)} // Update state
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Evaluation Criteria (What participants will rate)</Label>
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(true)}>
                Add New +
              </Button>
            </div>
            
            <div className="space-y-2 rounded-md border p-4">
              {criteria.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Settings</Label>
            <div className="flex items-center space-x-2 rounded-md border p-4">
              <Checkbox 
                id="blinded"
                checked={isBlinded} // Connect to state
                onCheckedChange={setIsBlinded} // Update state
              />
              <Label htmlFor="blinded" className="font-normal">
                Blinded Evaluation (Hide artifact origin)
              </Label>
            </div>
          </div>

          {/* This will show an error if saving fails */}
          {error && (
            <p className="text-center text-red-600">{error}</p>
          )}

        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline">Cancel</Button>
          {/* --- 5. CONNECT THE "NEXT" BUTTON --- */}
          <Button onClick={handleCreateStudy}>Next: Select Artifacts &gt;</Button>
        </CardFooter>
      </Card>

      {/* --- DIALOG (No change) --- */}
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