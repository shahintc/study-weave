// src/pages/ParticipantCompetencyAssessment.jsx

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

const QUESTION_SECTIONS = [
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

const questionSchemaShape = {};
const defaultFormValues = {};
QUESTION_SECTIONS.forEach((section) => {
  section.questions.forEach((question) => {
    questionSchemaShape[question.id] = buildQuestionSchema(question);
    defaultFormValues[question.id] = "";
  });
});

const formSchema = z.object(questionSchemaShape);

const ASSIGNMENT_OVERVIEW = {
  id: "assignment-baseline-001",
  title: "Baseline Competency Check",
  studyTitle: "Comparison Study 1",
  dueAt: "October 30, 2025 at 23:59 PST",
  reviewer: "Dr. Ada Researcher",
  totalScore: 100,
  estimatedTime: "10–15 minutes",
  statusLabel: "Awaiting submission",
  notes: "Submitting this assessment unlocks researcher studies that match your skill level.",
  instructions: [
    "Set aside uninterrupted time. There is no autosave yet.",
    "Use complete sentences for written answers — researchers review clarity.",
    "Once you submit, answers are locked for this assignment.",
  ],
  resources: [
    { id: "rubric", label: "Download rubric (PDF)", description: "See how responses are scored." },
    {
      id: "sample",
      label: "View sample response",
      description: "Read a high-quality example from another participant.",
    },
  ],
};

export default function ParticipantCompetencyAssessment() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const watchedValues = form.watch();
  const totalQuestions = QUESTION_SECTIONS.reduce(
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
      const payload = {
        assignmentId: ASSIGNMENT_OVERVIEW.id,
        responses: values,
      };
      console.log("Submitting values:", payload);

      // TODO: Replace with real API call.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      alert("Assessment submitted successfully!");
      setConfirmOpen(false);
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  let questionNumber = 0;

  const renderQuestionInput = (question, field) => {
    if (question.type === "choice") {
      return (
        <RadioGroup
          className="space-y-2"
          value={field.value}
          onValueChange={field.onChange}
        >
          {question.options.map((option) => (
            <div
              key={option.value}
              className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50"
            >
              <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
              <Label htmlFor={`${question.id}-${option.value}`} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
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

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{ASSIGNMENT_OVERVIEW.studyTitle}</p>
              <CardTitle>{ASSIGNMENT_OVERVIEW.title}</CardTitle>
            </div>
            <Badge variant="outline">{ASSIGNMENT_OVERVIEW.statusLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{ASSIGNMENT_OVERVIEW.notes}</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Due</p>
            <p className="text-base font-medium">{ASSIGNMENT_OVERVIEW.dueAt}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Estimated time</p>
            <p className="text-base font-medium">{ASSIGNMENT_OVERVIEW.estimatedTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Reviewer</p>
            <p className="text-base font-medium">{ASSIGNMENT_OVERVIEW.reviewer}</p>
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
              {ASSIGNMENT_OVERVIEW.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
            <Separator />
            <div className="flex flex-wrap gap-3">
              {ASSIGNMENT_OVERVIEW.resources.map((resource) => (
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
                {ASSIGNMENT_OVERVIEW.totalScore} pts
              </p>
              <p>
                <span className="font-medium text-foreground">Reviewer:</span>{" "}
                {ASSIGNMENT_OVERVIEW.reviewer}
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
              {QUESTION_SECTIONS.map((section) => (
                <section key={section.id} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <p className="text-sm text-muted-foreground">{section.helper}</p>
                  </div>
                  <Separator />
                  <div className="space-y-6">
                    {section.questions.map((question) => {
                      questionNumber += 1;
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
                <Button type="button" onClick={handleValidateAndConfirm} disabled={isSubmitting}>
                  Submit assessment
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
