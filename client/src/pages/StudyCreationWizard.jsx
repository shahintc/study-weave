// Copy this code into your client/src/pages/StudyCreationWizard.jsx file

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox"; // Checkbox is now imported

function StudyCreationWizard() {
  return (
    // We add a light gray background and padding to center the card
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Study Creation Wizard</CardTitle>
          <CardDescription>
            Create New Study (Step 1 of 4: Details)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Study Title Section */}
          <div className="space-y-2">
            <Label htmlFor="study-title">Study Title</Label>
            <Input
              id="study-title"
              placeholder="AI vs. Human Code Readability"
            />
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <Label htmlFor="description">Description for Participants</Label>
            <Textarea
              id="description"
              placeholder="You will compare two code snippets..."
            />
          </div>

          {/* Evaluation Criteria Section */}
          <div className="space-y-2">
            <Label>Evaluation Criteria (What participants will rate)</Label>
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <span>Readability (1-5 Stars)</span>
                <Button variant="ghost" size="sm">
                  Add +
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Correctness (1-5 Stars)</span>
                <Button variant="ghost" size="sm">
                  Add +
                </Button>
              </div>
            </div>
          </div>

          {/* Settings Section (Now with the working Checkbox) */}
          <div className="space-y-2">
            <Label>Settings</Label>
            <div className="flex items-center space-x-2 rounded-md border p-4">
              <Checkbox id="blinded" />
              <Label
                htmlFor="blinded"
                className="font-normal"
              >
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
    </div>
  );
}

export default StudyCreationWizard;
