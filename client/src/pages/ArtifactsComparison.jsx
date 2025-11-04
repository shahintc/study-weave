import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

// TODO: Your friend MUST run this command to get the RadioGroup component:
// npx shadcn@latest add radio-group
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Mock data for the code snippets
const artifactA = `
1. function process(data) {
2.   var i = 0;
3.   while(i < data.len) {
4.     //...
5.     i++;
6.   }
7. }
`;

const artifactB = `
1. const process = (data) => {
2.   {
3.     for(let i=0; i<data.l...
4.       //...
5.   
6.   }
7.
`;

function ArtifactComparisonPage() {
  // Separate state for each radio group
  const [syncScroll, setSyncScroll] = useState("on");
  const [artifactChoice, setArtifactChoice] = useState(null);

  return (
    <div className="min-h-screen w-full bg-gray-100 p-8">
      {/* Header */}
      <div className="mb-4 max-w-7xl mx-auto">
        <h2 className="text-xl font-semibold">
          Study: AI vs. Human Code Readability (Task 3 of 3)
        </h2>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        {/* Top Section: Code Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Artifact A (Blinded)</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Using <pre> for code formatting */}
              <pre className="bg-white border p-4 rounded-md overflow-x-auto">
                <code>{artifactA}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifact B (Blinded)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-white border p-4 rounded-md overflow-x-auto">
                <code>{artifactB}</code>
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Sync Scrolling Option (matches new image) */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Label className="font-semibold">Sync Scrolling:</Label>
              {/* Sync Scroll Radio Group */}
              <RadioGroup
                value={syncScroll}
                onValueChange={setSyncScroll}
                className="flex"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="on" id="sync-on" />
                  <Label htmlFor="sync-on" className="font-normal">On</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="off" id="sync-off" />
                  <Label htmlFor="sync-off" className="font-normal">Off</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Section: Evaluation (matches new image) */}
        <Card>
          <CardHeader>
            <CardTitle>Your Evaluation</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Star Rating */}
            <div className="space-y-2">
              <Label className="font-semibold">Rate "Readability" (1-5 Stars):</Label>
              <div className="flex space-x-1">
                {/* Mockup shows text, so we'll use text buttons */}
                <Button variant="outline" size="icon">[ * ]</Button>
                <Button variant="outline" size="icon">[ * ]</Button>
                <Button variant="outline" size="icon">[ * ]</Button>
                <Button variant="outline" size="icon">[ ]</Button>
                <Button variant="outline" size="icon">[ ]</Button>
              </div>
            </div>

            {/* Artifact Choice (matches new image) */}
            <div className="space-y-2">
              <Label className="font-semibold">Which artifact was more readable?</Label>
              {/* Artifact Choice Radio Group */}
              <RadioGroup
                value={artifactChoice}
                onValueChange={setArtifactChoice}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="a" id="artifact-a" />
                  <Label htmlFor="artifact-a" className="font-normal">A</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="b" id="artifact-b" />
                  <Label htmlFor="artifact-b" className="font-normal">B</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Annotations */}
            <div className="space-y-2">
              <Label className="font-semibold" htmlFor="annotations">Annotations / Comments:</Label>
              <Textarea
                id="annotations"
                placeholder="Click text to highlight and add a comment."
              />
            </div>

            {/* Existing Comments */}
            <div className="space-y-2">
              <Label className="font-semibold">Your Comments:</Label>
              <div className="rounded-md border p-4 space-y-2 bg-gray-50">
                <div className="flex justify-between items-center">
                  <p className="text-sm">
                    "Line 3 (Artifact A): 'Using a while-loop here is less clear
                    than a for-loop.'"
                  </p>
                  <Button variant="ghost" size="sm">Add Comment</Button>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-wrap justify-between gap-4">
            <Button variant="outline">Save Draft</Button>
            <div className="flex items-center space-x-2">
              <Checkbox id="submit-final" />
              <Label htmlFor="submit-final" className="font-normal">Submit Final Evaluation (Button)</Label>
              <Button>Submit</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default ArtifactComparisonPage;