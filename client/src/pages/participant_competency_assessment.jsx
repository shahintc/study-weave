// src/pages/ParticipantCompetencyAssessment.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "../api/axios";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const FALLBACK_SECTIONS = [
  {
    id: "background",
    title: "Part 1: Background Questionnaire",
    helper: "These answers calibrate which studies you can access.",
    questions: [
      {
        id: "programmingExperience",
        label: "How many years of professional programming experience do you have?",
        helper: "Count full-time experience with any language or stack.",
        type: "choice",
        typeLabel: "Multiple choice",
        options: [
          { value: "0-1", label: "Less than 1 year" },
          { value: "1-3", label: "1 – 3 years" },
          { value: "3-5", label: "3 – 5 years" },
          { value: "5+", label: "More than 5 years" },
        ],
        validation: {
          message: "Please select the experience that matches you best.",
        },
      },
      {
        id: "reactDefinition",
        label: "Which statement best describes React?",
        helper: "Choose the option closest to your understanding.",
        type: "choice",
        typeLabel: "Multiple choice",
        options: [
          { value: "template", label: "A server-side template language for PHP" },
          { value: "framework", label: "A UI library for building component-driven interfaces" },
          { value: "database", label: "A NoSQL database optimized for real-time experiences" },
          { value: "compiler", label: "A compiler that converts TypeScript to C" },
        ],
        validation: {
          message: "Please answer Question 2 to continue.",
        },
      },
    ],
  },
  {
    id: "skills",
    title: "Part 2: Skills & Confidence Check",
    helper: "Share details so we can match you with advanced artifacts.",
    questions: [
      {
        id: "debugConfidence",
        label: "Rate your confidence debugging unfamiliar React code.",
        helper: "1 = not confident, 5 = very confident.",
        type: "scale",
        typeLabel: "Rating",
        scale: { min: 1, max: 5 },
        validation: {
          message: "Please rate your confidence level.",
        },
      },
      {
        id: "umlPurpose",
        label: "Briefly describe how you use UML during system design.",
        helper: "Share specific workflows or diagrams (minimum 25 characters).",
        type: "text",
        typeLabel: "Short answer",
        textareaRows: 5,
        validation: {
          minLength: 25,
          message: "Please provide at least 25 characters for this response.",
        },
      },
    ],
  },
];

const buildQuestionSchema = (question) => {
  const minLength = question.validation?.minLength ?? 1;
  const message =
    question.validation?.message || "Please complete this question before submitting.";
  return z.string().min(minLength, { message });
};

const buildSectionsFromAssignment = (assignment) => {
  const questions = assignment?.questions || [];
  if (!questions.length) {
    return FALLBACK_SECTIONS;
  }

  const allQuestions = questions.map((question, index) => {
    const type =
      question.type === "short_answer"
        ? "text"
        : question.type === "scale"
          ? "scale"
          : "choice";
    const computedId = question.id != null ? String(question.id) : `question-${index + 1}`;
    return {
      id: computedId,
      label: question.title || `Question ${index + 1}`,
      helper: question.helper || "",
      type,
      typeLabel:
        type === "text"
          ? "Short answer"
          : type === "scale"
            ? "Rating"
            : "Multiple choice",
      options:
        type === "choice"
          ? (question.options || []).map((option, optionIndex) => ({
              value: String(option.value || option.text || `option-${optionIndex + 1}`),
              label: option.label || option.text || `Option ${optionIndex + 1}`,
            }))
          : [],
      scale: question.scale,
      textareaRows: question.textareaRows,
      validation: question.validation || {},
    };
  });

  const mcQuestions = allQuestions.filter(q => q.type === 'choice' || q.type === 'scale');
  const saQuestions = allQuestions.filter(q => q.type === 'text');

  const sections = [];

  if (mcQuestions.length > 0) {
    sections.push({
      id: "multiple-choice-section",
      title: "Multiple Choice Questions",
      helper: "Select the best option for each question.",
      questions: mcQuestions,
    });
  }

  if (saQuestions.length > 0) {
    sections.push({
      id: "short-answer-section",
      title: "Short Answer Questions",
      helper: "Provide a detailed response for each prompt.",
      questions: saQuestions,
    });
  }

  return sections;
};

const buildSchemaShapeFromSections = (sections) => {
  const shape = {};
  sections.forEach((section) => {
    section.questions.forEach((question) => {
      shape[question.id] = buildQuestionSchema(question);
    });
  });
  return shape;
};

const buildDefaultValuesFromSections = (sections) => {
  const defaults = {};
  sections.forEach((section) => {
    section.questions.forEach((question) => {
      defaults[question.id] = "";
    });
  });
  return defaults;
};


export default function ParticipantCompetencyAssessment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState("");

  const selectedAssignment = useMemo(() => {
    if (!assignments.length) {
      return null;
    }
    return assignments.find((assignment) => assignment.id === activeAssignmentId) || assignments[0];
  }, [assignments, activeAssignmentId]);

  const questionSections = useMemo(
    () => buildSectionsFromAssignment(selectedAssignment),
    [selectedAssignment],
  );

  const questionSchemaShape = useMemo(
    () => buildSchemaShapeFromSections(questionSections),
    [questionSections],
  );
  const dynamicSchema = useMemo(() => z.object(questionSchemaShape), [questionSchemaShape]);
  const defaultAnswers = useMemo(
    () => buildDefaultValuesFromSections(questionSections),
    [questionSections],
  );

  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: defaultAnswers,
  });

  useEffect(() => {
    form.reset(defaultAnswers);
  }, [defaultAnswers, form]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "participant") {
        navigate("/login");
        return;
      }
      setUser(parsed);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchAssignments = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setIsAssignmentsLoading(true);
    setAssignmentsError("");
    try {
      const { data } = await axios.get("/api/competency/assignments", {
        params: { participantId: user.id },
      });
      const payload = data.assignments || [];
      setAssignments(payload);
      setActiveAssignmentId(payload[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to load assignments", error);
      setAssignmentsError(error.response?.data?.message || "Unable to load assignments right now");
    } finally {
      setIsAssignmentsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const watchedValues = form.watch();
  const totalQuestions = questionSections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );

  const answeredCount = useMemo(() => {
    if (!watchedValues) return 0;
    return Object.values(watchedValues).reduce((count, value) => {
      if (typeof value === "string" && value.trim().length > 0) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [watchedValues]);

  const completionPercent = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;

  const handleValidateAndConfirm = () => {
    form.handleSubmit(() => setConfirmOpen(true))();
  };

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      if (!selectedAssignment) {
        alert("No assignment selected.");
        setIsSubmitting(false);
        return;
      }
      const payload = {
        responses: values,
      };
      console.log("Submitting values:", payload);

      await axios.post(`/api/competency/assignments/${selectedAssignment.id}/submit`, payload);

      alert("Assessment submitted successfully!");
      setConfirmOpen(false);
      fetchAssignments(); // Refetch assignments to update the UI
    } catch (error) {
      console.error("Submission failed:", error);
      if (error.response?.data?.message === "This assessment has already been submitted.") {
        alert("You have already submitted this assessment.");
      } else {
        alert("Submission failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestionInput = (question, field) => {
    if (question.type === "choice") {
      const radioValue = typeof field.value === "string" ? field.value : "";
      return (
        <RadioGroup
          className="space-y-2"
          value={radioValue}
          onValueChange={field.onChange}
        >
          {question.options.map((option) => (
            <label
              key={option.value}
              htmlFor={`${question.id}-${option.value}`}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                radioValue === option.value
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
              <span className="text-sm font-medium text-foreground">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      );
    }

    if (question.type === "scale") {
      const min = question.scale?.min ?? 1;
      const max = question.scale?.max ?? 5;
      return (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Choose a value (${min}–${max})`} />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: max - min + 1 }, (_, index) => {
              const value = String(min + index);
              return (
                <SelectItem value={value} key={value}>
                  {value}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Textarea
        rows={question.textareaRows ?? 4}
        placeholder={question.placeholder || "Type your response"}
        value={field.value}
        onChange={field.onChange}
      />
    );
  };

  if (isAssignmentsLoading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Loading competency assignments…</CardTitle>
            <CardDescription>Please wait while we fetch your open quizzes.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>No competency assignments</CardTitle>
            <CardDescription>Researchers will send competency quizzes here when you join a study.</CardDescription>
          </CardHeader>
          {assignmentsError ? (
            <CardContent>
              <p className="text-sm text-destructive">{assignmentsError}</p>
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  const overview = selectedAssignment || assignments[0];
  const isAssessmentLocked = Boolean(
    overview && (overview.isLocked || ['submitted', 'reviewed'].includes((overview.status || '').toLowerCase()))
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>My competency assignments</CardTitle>
          <CardDescription>Pick a quiz to review its instructions and submit your responses.</CardDescription>
          {assignmentsError ? (
            <p className="text-xs text-destructive">{assignmentsError}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {assignments.map((assignment) => {
            const isActive = assignment.id === overview.id;
            return (
              <div
                key={assignment.id}
                className={`flex flex-col gap-2 rounded-md border p-4 text-sm md:flex-row md:items-center md:justify-between ${
                  isActive ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div>
                  <p className="font-medium text-foreground">{assignment.title}</p>
                  <p className="text-xs text-muted-foreground">{assignment.studyTitle}</p>
                </div>
                <div className="text-xs text-muted-foreground md:text-right">
                  <p>Researcher: {assignment.reviewer}</p>
                  <p>Due {assignment.dueAt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={assignment.statusChip === "Awaiting submission" ? "secondary" : "outline"}>
                    {assignment.statusChip}
                  </Badge>
                  <Button size="sm" variant={isActive ? "default" : "outline"} onClick={() => setActiveAssignmentId(assignment.id)}>
                    {isActive ? "Viewing" : "Open"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{overview.studyTitle}</p>
              <CardTitle>{overview.title}</CardTitle>
            </div>
            <Badge variant="outline">{overview.statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{overview.notes}</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Due</p>
            <p className="text-base font-medium">{overview.dueAt}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Estimated time</p>
            <p className="text-base font-medium">{overview.estimatedTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Reviewer</p>
            <p className="text-base font-medium">{overview.reviewer}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Instructions & resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {(overview.instructions || []).map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
            <Separator />
            <div className="flex flex-wrap gap-3">
              {(overview.resources || []).map((resource) => (
                <Button key={resource.id} type="button" variant="outline" size="sm">
                  {resource.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {answeredCount}/{totalQuestions} answered
                </span>
                <span>{completionPercent}%</span>
              </div>
              <Progress value={completionPercent} className="mt-2" />
            </div>
            <Separator />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Total score:</span>{" "}
                {overview.totalScore ?? 0} pts
              </p>
              <p>
                <span className="font-medium text-foreground">Reviewer:</span>{" "}
                {overview.reviewer || "Research team"}
              </p>
              <p>
                <span className="font-medium text-foreground">Need help?</span> Email
                support@studyweave.ai
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={(event) => event.preventDefault()}>
          <Card>
            <CardHeader>
              <CardTitle>Assessment form</CardTitle>
              <p className="text-sm text-muted-foreground">
                Answer each section carefully. All fields are required.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {questionSections.map((section) => (
                <section key={section.id} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <p className="text-sm text-muted-foreground">{section.helper}</p>
                  </div>
                  <Separator/>
                  <div className="space-y-6">
                    {section.questions.map((question, index) => {
                      const questionNumber = index + 1;
                      return (
                        <FormField
                          key={question.id}
                          control={form.control}
                          name={question.id}
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <FormLabel className="text-base font-medium">
                                  Q{questionNumber}. {question.label}
                                </FormLabel>
                                <Badge variant="secondary" className="text-xs uppercase">
                                  {question.typeLabel}
                                </Badge>
                              </div>
                              {question.helper ? (
                                <FormDescription>{question.helper}</FormDescription>
                              ) : null}
                              <FormControl>{renderQuestionInput(question, field)}</FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </CardContent>

            <CardFooter className="flex flex-col gap-4 border-t bg-muted/50 p-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                You can review your answers before confirming submission. Draft saving arrives soon.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" disabled>
                  Save draft (coming soon)
                </Button>
                <Button
                  type="button"
                  onClick={handleValidateAndConfirm}
                  disabled={isSubmitting || isAssessmentLocked}
                >
                  {isAssessmentLocked ? 'Already Submitted' : 'Submit assessment'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ready to submit?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not be able to change your answers after submission. Please confirm everything
              looks correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Yes, submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
