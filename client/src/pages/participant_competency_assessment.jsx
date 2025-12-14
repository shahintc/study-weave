// src/pages/ParticipantCompetencyAssessment.jsx

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link, useBeforeUnload } from 'react-router-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "../api/axios";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Timer, Expand, ChevronsRight, Eye } from "lucide-react";
import { AssessmentPreviewModal } from "./AssessmentPreviewModal";
import { useToast } from "@/hooks/use-toast";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

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
  const minLength = question.validation?.minLength ?? 0;
  const message =
    question.validation?.message || "Please complete this question before submitting.";

  if (question.type === "multi_choice") {
    return z
      .array(z.string())
      .optional()
      .transform((val) => (Array.isArray(val) ? val : []))
      .refine(
        (arr) => arr.length === 0 || arr.every((item) => typeof item === "string"),
        { message },
      );
  }

  return z
    .string()
    .optional()
    .transform((val) => (typeof val === "string" ? val : ""))
    .refine((val) => val.length === 0 || val.length >= minLength, { message });
};

const buildSectionsFromAssignment = (assignment) => {
  const questions = assignment?.questions || [];
  if (!questions.length) {
    return FALLBACK_SECTIONS;
  }

  const allQuestions = questions.map((question, index) => {
    const hasMultipleCorrect =
      Array.isArray(question.options) && question.options.filter((opt) => opt.isCorrect).length > 1;
    const isMultiChoice = question.type === "multi_choice" || (question.type === "multiple_choice" && hasMultipleCorrect);
    const type =
      question.type === "short_answer"
        ? "text"
        : question.type === "scale"
          ? "scale"
          : isMultiChoice
            ? "multi_choice"
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
          : type === "multi_choice"
            ? "Multiple select"
            : "Multiple choice",
      options:
        type === "choice" || type === "multi_choice"
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

  const mcQuestions = allQuestions.filter(q => q.type === 'choice' || q.type === 'multi_choice' || q.type === 'scale');
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
      defaults[question.id] = question.type === "multi_choice" ? [] : "";
    });
  });
  return defaults;
};

const buildTimerStorageKey = (assignmentId) => `competencyTimer:${assignmentId}`;
const ACTIVE_COMPETENCY_KEY = "competencyActive";
const ANSWER_STORAGE_KEY = (assignmentId) => `competencyAnswers:${assignmentId}`;
const persistActiveCompetency = (payload) => {
  try {
    if (payload) {
      localStorage.setItem(ACTIVE_COMPETENCY_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(ACTIVE_COMPETENCY_KEY);
    }
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("competency-active-changed"));
  } catch {
    // ignore
  }
};


export default function ParticipantCompetencyAssessment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null); // Will be null initially
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [assessmentState, setAssessmentState] = useState("instructions"); // instructions, in_progress
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const durationRef = useRef(null);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const [pendingStartAssignmentId, setPendingStartAssignmentId] = useState(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [timeUpOpen, setTimeUpOpen] = useState(false);
  const questionRefs = useRef({});
  const [previewAssignment, setPreviewAssignment] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [resumeChip, setResumeChip] = useState(null);

  // --- Warn on Leave Logic ---
  useBeforeUnload(
    useCallback(() => {
      if (assessmentState === "in_progress") return "Are you sure you want to leave? Your progress will be submitted.";
    }, [assessmentState])
  );

  const selectedAssignment = useMemo(() => {
    if (!assignments.length) {
      return null;
    }
    return assignments.find((assignment) => assignment.id === activeAssignmentId) || null;
  }, [assignments, activeAssignmentId]);
  
  const { activeAssignments, completedAssignments } = useMemo(() => {
    const active = assignments.filter(a => !a.isLocked);
    const completed = assignments.filter(a => a.isLocked);
    return { activeAssignments: active, completedAssignments: completed };
  }, [assignments]);
  const durationInSeconds = useMemo(() => {
    if (!selectedAssignment?.estimatedTime) return null;
    const minutes = parseInt(selectedAssignment.estimatedTime, 10);
    return Number.isFinite(minutes) ? minutes * 60 : null;
  }, [selectedAssignment]);

  useEffect(() => {
    durationRef.current = durationInSeconds;
  }, [durationInSeconds]);

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
    if (!selectedAssignment?.id) return;
    try {
      const timerRaw = localStorage.getItem(buildTimerStorageKey(selectedAssignment.id));
      if (!timerRaw) {
        // No timer start, treat as fresh attempt
        form.reset(defaultAnswers);
        return;
      }
      const raw = localStorage.getItem(ANSWER_STORAGE_KEY(selectedAssignment.id));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.values) {
        form.reset({ ...defaultAnswers, ...parsed.values });
      }
    } catch {
      // ignore parse errors
    }
  }, [selectedAssignment?.id, defaultAnswers, form]);

  // --- Timer Logic ---
  const persistTimerStart = (assignmentId, startedAtMs) => {
    if (!assignmentId) return;
    try {
      const key = buildTimerStorageKey(assignmentId);
      localStorage.setItem(
        key,
        JSON.stringify({ startedAt: startedAtMs, persistedAt: Date.now() }),
      );
      persistActiveCompetency({
        assignmentId,
        title: selectedAssignment?.title || "Competency",
        startedAt: startedAtMs,
        estimatedTime: selectedAssignment?.estimatedTime,
      });
    } catch {
      // ignore storage failures
    }
  };

  const clearTimerStart = (assignmentId) => {
    if (!assignmentId) return;
    try {
      localStorage.removeItem(buildTimerStorageKey(assignmentId));
      const active = localStorage.getItem(ACTIVE_COMPETENCY_KEY);
      if (active) {
        const parsed = JSON.parse(active);
        if (String(parsed?.assignmentId) === String(assignmentId)) {
          persistActiveCompetency(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const startTimer = (assignmentId, existingStartMs = null) => {
    const resolvedStart = existingStartMs || Date.now();
    startTimeRef.current = resolvedStart;
    setElapsedSeconds(Math.floor((Date.now() - resolvedStart) / 1000));
    persistTimerStart(assignmentId, resolvedStart);
    try {
      if (assignmentId && selectedAssignment) {
        persistActiveCompetency({
          assignmentId,
          title: selectedAssignment.title,
          startedAt: resolvedStart,
          estimatedTime: selectedAssignment.estimatedTime,
          durationSeconds: durationRef.current,
        });
        setResumeChip({
          assignmentId,
          title: selectedAssignment.title,
          estimatedTime: selectedAssignment.estimatedTime,
          startedAt: resolvedStart,
          durationSeconds: durationRef.current,
        });
      }
    } catch {
      // ignore
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const currentElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const limit = durationRef.current;
        if (limit && currentElapsed >= limit) {
          stopTimer();
          setTimeUpOpen(true); // Trigger time's up dialog
        }
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const endTime = Date.now();
    const timeTaken = startTimeRef.current ? Math.floor((endTime - startTimeRef.current) / 1000) : 0;
    if (durationRef.current && timeTaken > durationRef.current) {
      return durationRef.current; // Cap time taken at the duration limit
    }
    return timeTaken;
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Scroll to question
  const scrollToQuestion = (questionId) => {
    const element = questionRefs.current[questionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight the question briefly
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-shadow', 'duration-300');
      setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }
  };

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

  useEffect(() => {
    let autosaveInterval = null;
    const persistAnswers = () => {
      if (!selectedAssignment?.id) return;
      try {
        const values = form.getValues();
        localStorage.setItem(
          ANSWER_STORAGE_KEY(selectedAssignment.id),
          JSON.stringify({ values, savedAt: Date.now() }),
        );
        window.dispatchEvent(new Event("storage"));
      } catch {
        // ignore storage write failures
      }
    };
    if (assessmentState === "in_progress" && selectedAssignment?.id) {
      autosaveInterval = setInterval(persistAnswers, 5000);
    }
    return () => {
      if (autosaveInterval) clearInterval(autosaveInterval);
    };
  }, [assessmentState, form, selectedAssignment?.id]);

  useEffect(() => {
    if (assessmentState !== "in_progress" || !selectedAssignment?.id) return;
    const timer = setTimeout(() => {
      try {
        const values = form.getValues();
        localStorage.setItem(
          ANSWER_STORAGE_KEY(selectedAssignment.id),
          JSON.stringify({ values, savedAt: Date.now() }),
        );
        window.dispatchEvent(new Event("storage"));
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form, assessmentState, selectedAssignment?.id, form.watch()]);

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
      // Do not set an active assignment initially
      setAssessmentState("instructions"); // Reset state when fetching new assignments
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

  useEffect(() => {
    try {
      const rawActive = localStorage.getItem(ACTIVE_COMPETENCY_KEY);
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        if (parsed?.assignmentId) {
          setResumeChip({
            assignmentId: parsed.assignmentId,
            title: parsed.title,
            estimatedTime: parsed.estimatedTime,
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!assignments.length) {
      return;
    }
    assignments.forEach((assignment) => {
      const status = (assignment.status || '').toLowerCase();
      const isLocked = assignment.isLocked || status === 'submitted' || status === 'reviewed';
      if (isLocked) {
        clearTimerStart(assignment.id);
        try {
          localStorage.removeItem(ANSWER_STORAGE_KEY(assignment.id));
        } catch {
          // ignore
        }
      }
    });
    const resumeCandidate = assignments.find((assignment) => {
      const status = (assignment.status || '').toLowerCase();
      const isLocked = assignment.isLocked || status === 'submitted' || status === 'reviewed';
      if (isLocked) return false;
      try {
        const raw = localStorage.getItem(buildTimerStorageKey(assignment.id));
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed && parsed.startedAt;
      } catch {
        return false;
      }
    });

    if (resumeCandidate) {
      const raw = localStorage.getItem(buildTimerStorageKey(resumeCandidate.id));
      const parsed = raw ? JSON.parse(raw) : null;
      setActiveAssignmentId(resumeCandidate.id);
      setAssessmentState("in_progress");
      const startMs = parsed?.startedAt ? Number(parsed.startedAt) : null;
      if (startMs) {
        setResumeChip((prev) => ({
          assignmentId: resumeCandidate.id,
          title: resumeCandidate.title,
          estimatedTime: resumeCandidate.estimatedTime,
          startedAt: startMs,
          durationSeconds: durationRef.current,
          ...prev,
        }));
      }
      if (startMs) {
        startTimer(resumeCandidate.id, startMs);
      }
    } else if (!activeAssignmentId) {
      setActiveAssignmentId(assignments[0].id);
    }
  }, [assignments, activeAssignmentId]);

  const watchedValues = form.watch();
  const isQuestionAnswered = useCallback((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }, []);
  const totalQuestions = questionSections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );

  const answeredCount = useMemo(() => {
    if (!watchedValues) return 0;
    return Object.values(watchedValues).reduce(
      (count, value) => count + (isQuestionAnswered(value) ? 1 : 0),
      0
    );
  }, [isQuestionAnswered, watchedValues]);

  const completionPercent = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;
  const remainingSeconds = durationInSeconds
    ? Math.max(durationInSeconds - elapsedSeconds, 0)
    : null;

  const clearAnswer = (question) => {
    if (!question) return;
    if (question.type === "multi_choice") {
      form.setValue(question.id, []);
    } else {
      form.setValue(question.id, "");
    }
  };

  const handleValidateAndConfirm = () => {
    const unanswered = Math.max(0, totalQuestions - answeredCount);
    setUnansweredCount(unanswered);
    setConfirmOpen(true);
  };

  const forceSubmit = async () => {
    // A version of onSubmit that doesn't rely on the form being valid
    // It submits whatever answers are currently present.
    const currentValues = form.getValues();
    // We pass the current values directly to the main submit handler
    await onSubmit(currentValues);
    setLeaveConfirmOpen(false);
    setTimeUpOpen(false);
  };

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      if (!selectedAssignment) {
        toast({
          title: "No assignment selected",
          description: "Please choose a competency before submitting.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const timeTakenSeconds = stopTimer();
      const payload = {
        responses: values,
        timeTakenSeconds,
      };
      console.log("Submitting values:", payload);

      await axios.post(`/api/competency/assignments/${selectedAssignment.id}/submit`, payload);

      toast({
        title: "Competency submitted",
        description: "Your answers were submitted. You’ll be notified after review.",
      });
      clearTimerStart(selectedAssignment.id);
      try {
        localStorage.removeItem(ANSWER_STORAGE_KEY(selectedAssignment.id));
      } catch {
        // ignore
      }
      setConfirmOpen(false);
      setAssessmentState("submitted");
      fetchAssignments(); // Refetch assignments to update the UI
    } catch (error) {
      console.error("Submission failed:", error);
      if (error.response?.data?.message === "This assessment has already been submitted.") {
        toast({
          title: "Already submitted",
          description: "This competency was already submitted.",
        });
      } else {
        toast({
          title: "Submission failed",
          description: "Please try again or contact support if this continues.",
          variant: "destructive",
        });
      }
      startTimer(selectedAssignment?.id, startTimeRef.current); // Resume timer if submission fails
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestionInput = (question, field) => {
    if (question.type === "multi_choice") {
      const selectedValues = Array.isArray(field.value) ? field.value : [];
      const toggleValue = (value) => {
        const exists = selectedValues.includes(value);
        const next = exists ? selectedValues.filter((v) => v !== value) : [...selectedValues, value];
        field.onChange(next);
      };

      return (
        <div className="space-y-2">
          {question.options.map((option) => {
            const checked = selectedValues.includes(option.value);
            return (
              <label
                key={option.value}
                htmlFor={`${question.id}-${option.value}`}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                  checked ? "border-primary bg-primary/5" : "border-input bg-background hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  id={`${question.id}-${option.value}`}
                  checked={checked}
                  onCheckedChange={() => toggleValue(option.value)}
                />
                <span className="text-sm font-medium text-foreground">{option.label}</span>
              </label>
            );
          })}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clearAnswer(question)}
              className="text-xs"
              aria-label={`Clear answer for ${question.label}`}
            >
              Clear answer
            </Button>
          </div>
        </div>
      );
    }

    if (question.type === "choice") {
      const radioValue = typeof field.value === "string" ? field.value : "";
      return (
        <div className="space-y-2">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => clearAnswer(question)}
            className="text-xs"
            aria-label={`Clear answer for ${question.label}`}
          >
            Clear answer
          </Button>
        </div>
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
      <div className="space-y-2">
        <Textarea
          rows={question.textareaRows ?? 4}
          placeholder={question.placeholder || "Type your response"}
          value={field.value}
          onChange={field.onChange}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => clearAnswer(question)}
          className="text-xs"
          aria-label={`Clear answer for ${question.label}`}
        >
          Clear answer
        </Button>
      </div>
    );
  };

  const overview = selectedAssignment || assignments[0];
  const isAssessmentLocked = Boolean(
    overview && (overview.isLocked || ['submitted', 'reviewed'].includes((overview.status || '').toLowerCase()))
  );

  const handleOpenDetails = (assignmentId) => {
    if (assessmentState === 'in_progress' && assignmentId !== activeAssignmentId) {
      setLeaveConfirmOpen(true);
      // We don't proceed with opening the new one until confirmed.
      // A more robust solution might store the target and proceed on confirm.
      return;
    }
    setActiveAssignmentId(assignmentId);
    form.reset(defaultAnswers); // Reset form when switching
    setAssessmentState('instructions');
  };

  const handleOpenStartConfirmation = (assignmentId) => {
    setPendingStartAssignmentId(assignmentId);
    setStartConfirmOpen(true);
  };

  const handleStartAssessment = () => {
    if (!pendingStartAssignmentId) return;
    try {
      localStorage.removeItem(ANSWER_STORAGE_KEY(pendingStartAssignmentId));
      localStorage.removeItem(buildTimerStorageKey(pendingStartAssignmentId));
    } catch {
      // ignore storage cleanup failures
    }
    form.reset(defaultAnswers);
    setActiveAssignmentId(pendingStartAssignmentId);
    setStartConfirmOpen(false);
    setAssessmentState("in_progress");
    startTimer(pendingStartAssignmentId);
    setPendingStartAssignmentId(null);
  };

  const handleOpenPreview = (assignment) => {
    setPreviewAssignment(assignment);
    setIsPreviewOpen(true);
  };

  const activeResume = useMemo(() => {
    if (assessmentState === 'in_progress' && selectedAssignment) {
      return {
        assignmentId: selectedAssignment.id,
        title: selectedAssignment.title,
        estimatedTime: selectedAssignment.estimatedTime,
      };
    }
    return resumeChip;
  }, [assessmentState, selectedAssignment, resumeChip]);

  const renderResumeChip = () => {
    // Hide the in-page chip entirely; global chip in ParticipantLayout covers this use case.
    return null;
    const remaining =
      durationRef.current && startTimeRef.current
        ? Math.max(durationRef.current - Math.floor((Date.now() - startTimeRef.current) / 1000), 0)
        : null;
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg backdrop-blur">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Competency in progress</span>
          <span className="text-sm font-medium truncate max-w-[220px]">{activeResume.title || "Competency"}</span>
        </div>
        {Number.isFinite(remaining) ? (
          <Badge variant="outline" className="text-[11px]">
            {Math.max(Math.floor(remaining / 60), 0)}m left
          </Badge>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => {
            navigate("/participant/competency");
          }}
          aria-label="Return to active competency"
        >
          Resume
        </Button>
      </div>
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

  return (
    <div className={`p-6 md:p-10 mx-auto space-y-8 ${isFocusMode || assessmentState === 'in_progress' ? 'max-w-full px-4' : 'max-w-5xl'}`}>
      {renderResumeChip()}
      {!isFocusMode && assessmentState !== 'in_progress' && (
        <Card>
          <CardHeader>
            <CardTitle>My Competency Assignments</CardTitle>
            <CardDescription>Select an active assignment to begin or review a completed one.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="active"
              onValueChange={(tab) => {
                if (tab === 'completed') {
                  setActiveAssignmentId(null);
                }
              }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="pt-4 space-y-3">
                {activeAssignments.map((assignment) => {
                  const isActive = assignment.id === selectedAssignment?.id;
                  return (
                    <div
                      key={assignment.id}
                      className={`grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-4 items-center rounded-md border p-4 text-sm transition-colors ${activeAssignmentId === assignment.id ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div>
                        <p className="font-medium text-foreground">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">{assignment.studyTitle}</p>
                      </div>
                      <div className="text-xs text-muted-foreground md:text-center">
                        <p>Researcher: {assignment.reviewer}</p>
                        <p>Time limit: {assignment.estimatedTime || "No time limit"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={assignment.statusChip === "Awaiting submission" ? "secondary" : "outline"}>
                          {assignment.statusChip}
                        </Badge>
                        {!assignment.isLocked && assessmentState !== 'in_progress' && (
                          <Button size="sm" variant="outline" onClick={() => handleOpenDetails(assignment.id)}>
                            Open
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="completed" className="pt-4 space-y-3">
                {completedAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-4 items-center rounded-md border p-4 text-sm transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.studyTitle}</p>
                    </div>
                    <div className="text-xs text-muted-foreground md:text-center">
                      <p>Submitted on {new Date(assignment.submittedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={assignment.statusChip === "Reviewed" ? "default" : "outline"}>
                        {assignment.statusChip}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => handleOpenPreview(assignment)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {activeAssignmentId && selectedAssignment && !isFocusMode && !isAssessmentLocked && (assessmentState === 'instructions' || assessmentState === 'in_progress') && (
      <>
      <Card className="bg-muted/30">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{overview.studyTitle}</p>
              <CardTitle>{overview.title}</CardTitle>
            </div>
            <Badge variant="outline">{overview.statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase">Study</p>
                  <p className="font-medium">{overview.studyTitle || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase">Time limit</p>
                  <p className="font-medium">{overview.estimatedTime || "No time limit"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase">Reviewer</p>
                  <p className="font-medium">{overview.reviewer || "Research team"}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border bg-background p-4 shadow-sm">
                <p className="text-xs text-muted-foreground uppercase mb-2">Overview note</p>
                <p className="text-sm text-muted-foreground">
                  {overview.notes || "No overview note has been provided yet."}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="instructions" className="pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-background p-4 shadow-sm h-full">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Instructions</p>
                  {(overview.instructions || []).length ? (
                    <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                      {(overview.instructions || []).map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No instructions entered.</p>
                  )}
                </div>
                <div className="rounded-lg border bg-background p-4 shadow-sm h-full">
                  <p className="text-xs text-muted-foreground uppercase mb-2">Resources</p>
                  {(overview.resources || []).length ? (
                    <div className="flex flex-wrap gap-2">
                      {(overview.resources || []).map((resource) => (
                        <Button key={resource.id} type="button" variant="outline" size="sm">
                          {resource.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No resources shared yet.</p>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="progress" className="pt-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{answeredCount}/{totalQuestions} answered</span>
                <span>{completionPercent}%</span>
              </div>
              <Progress value={completionPercent} className="mt-2" />
              <Separator className="my-4" />
              <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Reviewer:</span>{" "}
                {overview.reviewer || "Research team"}
              </p>
              <p>
                <span className="font-medium text-foreground">Need help?</span> Email
                support@studyweave.ai
              </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      </>)}
      {activeAssignmentId && selectedAssignment && !isFocusMode && assessmentState === 'instructions' && !isAssessmentLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to begin?</CardTitle>
            <CardDescription>Once you start, a timer will begin. Please complete the assessment in one sitting.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => handleOpenStartConfirmation(activeAssignmentId)}>Start Assessment</Button>
          </CardFooter>
        </Card>
      )}
      {assessmentState === 'in_progress' && !isAssessmentLocked && (
        <div className="flex gap-6">
          {/* --- QUICK NAVIGATION SIDEBAR --- */}
          {(!isFocusMode) && (
            <div className="hidden lg:block w-64 space-y-4 sticky top-24 self-start">
              <h3 className="font-semibold text-sm">Questions</h3>
              <div
                className={`flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm ${
                  remainingSeconds !== null && remainingSeconds <= (durationInSeconds || 0) * 0.1
                    ? "border-destructive/50 text-destructive"
                    : "text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>{durationInSeconds ? "Time remaining" : "Time elapsed"}</span>
                </div>
                <span className="font-semibold">
                  {durationInSeconds ? formatTime(remainingSeconds) : formatTime(elapsedSeconds)}
                </span>
              </div>
              {questionSections.map(section => (
                <div key={section.id} className="space-y-1">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase">{section.title}</h4>
                  <div className="space-y-1">
                    {section.questions.map((q, index) => (
                      <Button
                        key={q.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground h-auto py-1"
                        onClick={() => scrollToQuestion(q.id)}
                      >
                        <span className={`mr-2 h-2 w-2 rounded-full ${isQuestionAnswered(watchedValues?.[q.id]) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        <span className="truncate">Q{index + 1}. {q.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1">
            <Form {...form}>
              <form onSubmit={(event) => event.preventDefault()}>
                <Card>
                  {/* --- STICKY HEADER --- */}
                  <CardHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle>Assessment Form</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setIsFocusMode(!isFocusMode)} title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}>
                          <Expand className="h-4 w-4" />
                        </Button>
                        <div className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium ${
                          durationInSeconds && elapsedSeconds > durationInSeconds * 0.9 ? 'bg-destructive/10 text-destructive' :
                          durationInSeconds && elapsedSeconds > durationInSeconds * 0.7 ? 'bg-amber-500/10 text-amber-600' :
                          !durationInSeconds ? 'bg-muted text-muted-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          <Timer className="h-4 w-4" />
                          <span>{durationInSeconds ? formatTime(remainingSeconds) : formatTime(elapsedSeconds)}</span>
                          {durationInSeconds && <span>/ {formatTime(durationInSeconds)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <p className="text-sm text-muted-foreground">Question Progress:</p>
                      {questionSections.flatMap(s => s.questions).map((q, i) => (
                        <div
                          key={q.id}
                          title={`Q${i+1}: ${q.label}`}
                          className={`h-2 w-4 rounded-full cursor-pointer ${isQuestionAnswered(watchedValues?.[q.id]) ? 'bg-green-500' : 'bg-gray-300'}`}
                          onClick={() => scrollToQuestion(q.id)}
                        />
                      ))}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-8 pt-6">
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
                              <div key={question.id} ref={el => questionRefs.current[question.id] = el} className="rounded-lg p-1 -m-1">
                                <FormField
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
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 border-t bg-muted/50 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Leaving or refreshing keeps your timer running. Unanswered questions will submit as blank when you finish or exit.
                    </div>
                    <Button
                      type="button"
                      onClick={handleValidateAndConfirm}
                      disabled={isSubmitting || isAssessmentLocked}
                    >
                      {isAssessmentLocked ? 'Already Submitted' : 'Submit assessment'}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          </div>
        </div>
      )}
      
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ready to submit?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredCount > 0
                ? `You have ${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"}. They will be submitted as blank.`
                : "You will not be able to change your answers after submission."}
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

      <AlertDialog open={startConfirmOpen} onOpenChange={setStartConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              The timer will begin as soon as you continue. Ensure you have enough time to complete the assessment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartAssessment}>
              Start Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              If you leave now, your current answers will be submitted automatically, and you will not be able to return. Are you sure you want to exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeaveConfirmOpen(false)}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={forceSubmit}>
              Leave and Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={timeUpOpen} onOpenChange={setTimeUpOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time's Up!</AlertDialogTitle>
            <AlertDialogDescription>
              The time limit for this assessment has been reached. Your answers will now be submitted automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={forceSubmit}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SubmissionPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        assignment={previewAssignment}
      />
    </div>
  );
}

const SubmissionPreviewModal = AssessmentPreviewModal;
