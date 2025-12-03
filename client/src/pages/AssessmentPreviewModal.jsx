import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const buildSectionsFromAssessmentData = (assessmentData) => {
  const questions = assessmentData?.questions || [];
  if (!questions.length) return [];

  return [
    {
      id: "assessment-preview",
      title: "Assessment Questions",
      helper: "This is a preview of how participants will see the questions.",
      questions: questions.map((question, index) => ({
        id: `q-${index}`,
        label: question.title,
        type: question.type,
        options:
          question.type === "multiple_choice"
            ? (question.options || []).map((opt, optIndex) => ({
                value: `opt-${optIndex}`,
                label: opt.text,
              }))
            : [],
      })),
    },
  ];
};

export function AssessmentPreviewModal({ isOpen, onClose, assessmentData }) {
  const questionSections = useMemo(
    () => buildSectionsFromAssessmentData(assessmentData),
    [assessmentData]
  );

  const [answers, setAnswers] = useState({});

  // Reset answers when a new assessment is previewed or modal is reopened
  useEffect(() => {
    if (isOpen) {
      setAnswers({});
    }
  }, [isOpen]);

  const handleAnswerChange = (questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  if (!assessmentData) return null;

  let questionNumber = 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment Preview</DialogTitle>
          <DialogDescription>This is how participants will see the assessment. You can interact with it to test the flow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle>{assessmentData.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{assessmentData.description}</p>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold mb-2">Instructions</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {assessmentData.instructions}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {questionSections.map((section) => (
                <section key={section.id} className="space-y-4">
                  <div className="space-y-6">
                    {section.questions.map((question) => {
                      questionNumber++;
                      return (
                        <div key={question.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-base font-medium">
                              Q{questionNumber}. {question.label}
                            </Label>
                            <Badge variant="secondary" className="text-xs uppercase">
                              {question.type.replace("_", " ")}
                            </Badge>
                          </div>
                          {question.type === "multiple_choice" ? (
                            <RadioGroup
                              value={answers[question.id] || ""}
                              onValueChange={(value) => handleAnswerChange(question.id, value)}
                              className="space-y-2"
                            >
                              {question.options.map((option) => (
                                <label
                                  key={option.value}
                                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                                    answers[question.id] === option.value
                                      ? "border-primary bg-primary/5"
                                      : "border-input bg-background hover:bg-muted/50"
                                  }`}
                                >
                                  <RadioGroupItem
                                    value={option.value}
                                    id={`${question.id}-${option.value}`}
                                  />
                                  <span className="text-sm font-medium text-foreground">
                                    {option.label}
                                  </span>
                                </label>
                              ))}
                            </RadioGroup>
                          ) : (
                            <Textarea
                              rows={4}
                              placeholder="Participant response will go here..."
                              value={answers[question.id] || ""}
                              onChange={(e) =>
                                handleAnswerChange(question.id, e.target.value)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Separator />
                </section>
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close Preview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}