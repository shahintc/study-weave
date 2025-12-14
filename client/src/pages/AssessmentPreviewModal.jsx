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
import { Checkbox } from "@/components/ui/checkbox";

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
  const mcQuestions = assignment.questions.filter(
    (q) => (q.type === "multiple_choice" || q.type === "multi_choice") && q.options?.length > 0,
  );
  if (mcQuestions.length === 0) {
    return { score: 0, total: 0, percentage: 0 };
  }
  let correctAnswers = 0;
  mcQuestions.forEach((question) => {
    const correctOptions = (question.options || []).filter((opt) => opt.isCorrect);
    const correctValues = correctOptions.map((opt) => String(opt.text));
    const rawResponse = assignment.responses?.[question.id];
    const responseValues = Array.isArray(rawResponse)
      ? rawResponse.map((val) => String(val))
      : rawResponse
        ? [String(rawResponse)]
        : [];
    const isCorrect =
      correctValues.length &&
      responseValues.length === correctValues.length &&
      correctValues.every((val) => responseValues.includes(val));
    if (isCorrect) {
      correctAnswers++;
    }
  });
  return {
    score: correctAnswers,
    total: mcQuestions.length,
    percentage: Math.round((correctAnswers / mcQuestions.length) * 100),
  };
};

const parseEstimatedSeconds = (estimatedTime) => {
  if (!estimatedTime) return null;
  // expected format like "30 minutes"
  const match = String(estimatedTime).match(/(\d+)\s*/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes * 60 : null;
};

export function AssessmentPreviewModal({ isOpen, onClose, assessmentData, assignment }) {
  const isParticipantReview = !!assignment;
  const data = isParticipantReview ? assignment : assessmentData;
  const estimatedSeconds = parseEstimatedSeconds(assignment?.estimatedTime);

  const { multipleChoiceQuestions, shortAnswerQuestions } = useMemo(() => {
    const allQuestions = (data?.questions || []).map((question, index) => {
        const questionId = question.id || `q-${index}`;
      const correctOptions =
        question.type === 'multiple_choice' || question.type === 'multi_choice'
          ? (question.options || []).filter(opt => opt.isCorrect)
          : [];
      const responseRaw = isParticipantReview ? assignment.responses?.[questionId] : null;
      const responseValues = Array.isArray(responseRaw)
        ? responseRaw.map((val) => String(val))
        : responseRaw
          ? [String(responseRaw)]
          : [];
      const responseDisplay = responseValues.length
        ? responseValues
        : ["No answer submitted"];
      return {
        id: questionId,
        label: question.title,
        type: question.type,
        typeLabel:
          question.type === 'multi_choice'
            ? 'Multiple select'
            : question.type === 'multiple_choice'
              ? 'Multiple choice'
              : question.type === 'short_answer'
                ? 'Short answer'
                : question.type,
        options:
          question.type === "multiple_choice" || question.type === "multi_choice"
            ? (question.options || []).map((opt, optIndex) => ({
                value: String(opt.text || `opt-${optIndex}`),
                label: opt.text,
              }))
            : [],
        responseValues,
        responseDisplay,
        isCorrect:
          correctOptions.length > 0
            ? responseValues.length === correctOptions.length &&
              correctOptions.every((opt) => responseValues.includes(String(opt.text)))
            : null,
        correctAnswers: correctOptions.map((opt) => String(opt.text)),
        isMulti:
          question.type === 'multi_choice' ||
          ((question.type === 'multiple_choice') &&
            (question.options || []).filter((opt) => opt.isCorrect).length > 1),
      };
    });
    return {
      multipleChoiceQuestions: allQuestions.filter(q => q.type === 'multiple_choice' || q.type === 'multi_choice'),
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
              <p className="text-sm text-muted-foreground">
                {data.description || data.notes || "No description provided."}
              </p>
              {!isParticipantReview ? (
                <p className="text-xs text-muted-foreground mt-2">
                  {Array.isArray(data.instructions) && data.instructions.length
                    ? data.instructions.join(" • ")
                    : "No instructions provided."}
                </p>
              ) : null}
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
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold">{performance.percentage}%</p>
                        <span className="text-xs text-muted-foreground">
                          ({performance.score}/{performance.total} correct)
                        </span>
                      </div>
                      {Number.isFinite(assignment?.timeTakenSeconds) && (
                        <Badge variant="outline" className="text-[11px]">
                          Time: ~{Math.round(assignment.timeTakenSeconds / 60)} min
                        </Badge>
                      )}
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
                            {question.typeLabel}
                          </Badge>
                        </div>
                        {isParticipantReview ? (
                          <div
                            className={`p-3 rounded text-sm ${
                              assignment.status === 'reviewed' && question.isCorrect === true
                                ? 'bg-green-50 border border-green-200'
                                : assignment.status === 'reviewed' && question.isCorrect === false
                                  ? 'bg-red-50 border border-red-200'
                                  : 'bg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              {question.responseValues.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No answer submitted</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {question.responseDisplay.map((resp, idx) => (
                                    <Badge key={idx} variant="secondary">
                                      {resp}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {assignment.status === 'reviewed' && question.isCorrect === true && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                              {assignment.status === 'reviewed' && question.isCorrect === false && (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            {assignment.status === 'reviewed' && question.isCorrect === false && question.correctAnswers?.length ? (
                              <div className="mt-2 pt-2 border-t border-red-200 space-y-1">
                                <p className="text-xs text-red-800 font-medium">Correct answer{question.correctAnswers.length > 1 ? 's' : ''}:</p>
                                <div className="flex flex-wrap gap-2">
                                  {question.correctAnswers.map((answer, idx) => (
                                    <Badge key={idx} variant="outline">
                                      {answer}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          question.isMulti ? (
                            <div className="space-y-2">
                              {question.options.map((option) => {
                                const selected = Array.isArray(answers[question.id])
                                  ? answers[question.id].includes(option.value)
                                  : false;
                                const toggle = () => {
                                  const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                                  const next = selected
                                    ? current.filter((val) => val !== option.value)
                                    : [...current, option.value];
                                  handleAnswerChange(question.id, next);
                                };
                                return (
                                  <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                                      selected ? "border-primary bg-primary/5" : "border-input bg-background hover:bg-muted/50"
                                    }`}
                                  >
                                    <Checkbox
                                      id={`${question.id}-${option.value}`}
                                      checked={selected}
                                      onCheckedChange={toggle}
                                    />
                                    <span className="text-sm font-medium text-foreground">
                                      {option.label}
                                    </span>
                                  </label>
                                );
                              })}
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
                          )
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
                            {question.typeLabel}
                          </Badge>
                        </div>
                        {isParticipantReview ? (
                          <div className="p-3 bg-muted rounded text-sm">
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {question.responseDisplay && question.responseDisplay.length
                                ? question.responseDisplay.join(", ")
                                : "No answer submitted"}
                            </p>
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
