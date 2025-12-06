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
import { Check, X, CheckCircle, AlertCircle } from "lucide-react";

const formatReviewDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const calculatePerformance = (assignment) => {
  if (!assignment?.questions || !assignment?.responses) {
    return { score: 0, total: 0, percentage: 0 };
  }
  const mcQuestions = assignment.questions.filter(q => q.type === "multiple_choice" && q.options?.length > 0);
  if (mcQuestions.length === 0) {
    return { score: 0, total: 0, percentage: 0 };
  }
  let correctAnswers = 0;
  mcQuestions.forEach((question) => {
    const correctOption = question.options.find((opt) => opt.isCorrect);
    const participantResponse = assignment.responses[question.id];
    if (correctOption && participantResponse === correctOption.text) {
      correctAnswers++;
    }
  });
  return {
    score: correctAnswers,
    total: mcQuestions.length,
    percentage: Math.round((correctAnswers / mcQuestions.length) * 100),
  };
};

export function AssessmentPreviewModal({ isOpen, onClose, assessmentData, assignment }) {
  const isParticipantReview = !!assignment;
  const data = isParticipantReview ? assignment : assessmentData;

  const { multipleChoiceQuestions, shortAnswerQuestions } = useMemo(() => {
    const allQuestions = (data?.questions || []).map((question, index) => {
      const questionId = question.id || `q-${index}`;
      const correctOption = question.type === 'multiple_choice' ? (question.options || []).find(opt => opt.isCorrect) : null;
      const response = isParticipantReview ? (assignment.responses?.[questionId] || "(No response provided)") : null;
      return {
        id: questionId,
        label: question.title,
        type: question.type,
        options:
          question.type === "multiple_choice"
            ? (question.options || []).map((opt, optIndex) => ({
                value: String(opt.text || `opt-${optIndex}`),
                label: opt.text,
              }))
            : [],
        response,
        isCorrect: correctOption ? response === correctOption.text : null,
        correctAnswer: correctOption ? correctOption.text : null,
      };
    });
    return {
      multipleChoiceQuestions: allQuestions.filter(q => q.type === 'multiple_choice'),
      shortAnswerQuestions: allQuestions.filter(q => q.type === 'short_answer'),
    };
  }, [data, isParticipantReview, assignment]);

  const [answers, setAnswers] = useState({});
  const performance = useMemo(() => isParticipantReview ? calculatePerformance(assignment) : null, [assignment, isParticipantReview]);

  // Reset answers when a new assessment is previewed or modal is reopened
  useEffect(() => {
    if (isOpen && !isParticipantReview) {
      setAnswers({});
    }
  }, [isOpen, isParticipantReview]);

  const handleAnswerChange = (questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isParticipantReview ? "Submission Review" : "Assessment Preview"}</DialogTitle>
          <DialogDescription>
            {isParticipantReview
              ? "This is a read-only view of your submitted answers."
              : "This is how participants will see the assessment. You can interact with it to test the flow."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle>{data.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{data.description || data.notes}</p>
            </CardHeader>
            {isParticipantReview && performance && (
              <CardContent className="space-y-3">
                {/* Timeline View */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Timeline</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex flex-col items-center self-stretch">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                      {assignment.reviewedAt && <div className="h-full w-0.5 bg-blue-500"></div>}
                    </div>
                    <p>Submitted on {formatReviewDate(assignment.submittedAt)}</p>
                  </div>
                  {assignment.reviewedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex flex-col items-center self-stretch">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                      </div>
                      <p>Reviewed on {formatReviewDate(assignment.reviewedAt)}</p>
                    </div>
                  )}
                </div>
                <Separator />
                {/* Performance Score - only show if reviewed */}
                {performance.total > 0 && (
                  <div className="flex items-center justify-between pt-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">MCQ Performance</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{performance.percentage}%</p>
                      <span className="text-xs text-muted-foreground">
                        ({performance.score}/{performance.total} correct)
                      </span>
                    </div>
                  </div>
                )}
                <Separator />
                {/* Reviewer Notes - only show if reviewed */}
                {assignment.reviewerNotes && (
                  <div className="pt-2">
                    <h3 className="font-semibold mb-2">Reviewer Notes</h3>
                    <blockquote className="border-l-2 pl-4 italic text-muted-foreground">
                      {assignment.reviewerNotes}
                    </blockquote>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* --- MULTIPLE CHOICE SECTION --- */}
              {multipleChoiceQuestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Multiple Choice Questions</h3>
                  <div className="space-y-6 pt-2">
                    {multipleChoiceQuestions.map((question, index) => (
                      <div key={question.id} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-base font-medium">
                            Q{index + 1}. {question.label}
                          </Label>
                          <Badge variant="secondary" className="text-xs uppercase">
                            {question.type.replace("_", " ")}
                          </Badge>
                        </div>
                        {isParticipantReview ? (
                          <div className={`p-3 rounded text-sm ${
                            assignment.status === 'reviewed' && question.isCorrect === true ? 'bg-green-100' : 
                            assignment.status === 'reviewed' && question.isCorrect === false ? 'bg-red-100' : 
                            'bg-muted'
                          }`}>
                            <div className="flex items-center justify-between">
                              <p className="font-semibold">{question.response}</p>
                              {assignment.status === 'reviewed' && question.isCorrect === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                              {assignment.status === 'reviewed' && question.isCorrect === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                            </div>
                            {assignment.status === 'reviewed' && question.isCorrect === false && question.correctAnswer && (
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <p className="text-xs text-red-800">
                                  Correct answer: <span className="font-semibold">{question.correctAnswer}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
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
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {multipleChoiceQuestions.length > 0 && shortAnswerQuestions.length > 0 && (
                <Separator className="my-8" />
              )}

              {/* --- SHORT ANSWER SECTION --- */}
              {shortAnswerQuestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Short Answer Questions</h3>
                  <div className="space-y-6 pt-2">
                    {shortAnswerQuestions.map((question, index) => (
                      <div key={question.id} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Label className="text-base font-medium">
                            Q{index + 1}. {question.label}
                          </Label>
                          <Badge variant="secondary" className="text-xs uppercase">
                            {question.type.replace("_", " ")}
                          </Badge>
                        </div>
                        {isParticipantReview ? (
                          <div className="p-3 bg-muted rounded text-sm">
                            <p className="text-muted-foreground whitespace-pre-wrap">{question.response}</p>
                          </div>
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
                    ))}
                  </div>
                </div>
              )}

              {multipleChoiceQuestions.length === 0 && shortAnswerQuestions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No questions have been added to this assessment yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}