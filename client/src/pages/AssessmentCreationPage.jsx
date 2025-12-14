import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Save, Upload, Zap, Clock, TrendingUp, Eye, Layers, Users, Search, FileText, ListChecks } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

// --- SHADCN/UI COMPONENTS ---
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { QuestionImportModal } from "./QuestionImportModal";
import { QuizGenerationModal } from "./QuizGenerationModal";
import { AssessmentPreviewModal } from "./AssessmentPreviewModal";


// --- ZOD SCHEMA (Assessment Builder) ---
const optionSchema = z.object({
  text: z.string().min(1, { message: "Option text cannot be empty." }),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    title: z.string().min(1, { message: "Question title is required." }),
    type: z.enum(["multiple_choice", "short_answer"]),
    options: z.array(optionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "multiple_choice") {
      if (!data.options || data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Multiple choice questions must have at least 2 options.",
        });
        return;
      }
      if (!data.options.some((option) => option.isCorrect)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Mark at least one option as correct.",
        });
      }
    }
  });

const assessmentSchema = z.object({
  title: z.string().min(5, { message: "Assessment title must be at least 5 characters." }),
  description: z.string().min(1, { message: "Provide a short description." }),
  duration: z.string().regex(/^\d+$/, { message: "Duration must be a number (in minutes)." }),
  passingThreshold: z.string().regex(/^\d+$/, { message: "Threshold must be a number (percentage)." }),
  instructions: z.string().min(20, { message: "Share instructions for participants (20+ chars)." }),
  status: z.enum(["draft", "published"]),
  questions: z.array(questionSchema).min(1, { message: "An assessment must have at least one question." }),
  invitedParticipants: z.array(z.number()).optional(),
});

// Default initial question for a clean start
const defaultQuestion = {
  title: "",
  type: "multiple_choice",
  options: [
    { text: "Option A", isCorrect: false },
    { text: "Option B", isCorrect: true },
  ],
};

// Default for short answer questions
const defaultShortAnswerQuestion = {
  title: "",
  type: "short_answer",
  options: [],
};

// header/nav removed

// --- Dynamic Options Component ---
// Separated component for managing options within a specific question
function OptionsFieldArray({ questionIndex, control, errors }) {
    const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
        control,
        name: `questions.${questionIndex}.options`,
    });

    const removeOptionHandler = (optionIndex) => {
        if (optionFields.length > 2) {
            removeOption(optionIndex);
        } else {
            // Cannot remove if only two options remain (Zod minimum requirement)
            alert("A question must have at least two options.");
        }
    };

    const optionError = errors?.questions?.[questionIndex]?.options?.message;

    return (
        <div className="space-y-3">
            {optionFields.map((oField, oIndex) => (
                <div key={oField.id} className="flex items-center space-x-3">
                    {/* Checkbox for IsCorrect */}
                    <FormField
                        control={control}
                        name={`questions.${questionIndex}.options.${oIndex}.isCorrect`}
                        render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="font-normal text-xs whitespace-nowrap">Correct</FormLabel>
                            </FormItem>
                        )}
                    />

                    {/* Input for Option Text */}
                    <FormField
                        control={control}
                        name={`questions.${questionIndex}.options.${oIndex}.text`}
                        render={({ field }) => (
                            <FormItem className="flex-grow">
                                <FormControl>
                                    <Input placeholder={`Option ${oIndex + 1} text...`} {...field} />
                                </FormControl>
                                {/* Option text specific errors can be displayed here if needed */}
                            </FormItem>
                        )}
                    />

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOptionHandler(oIndex)}
                        disabled={optionFields.length <= 2}
                    >
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            ))}

            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendOption({ text: `Option ${optionFields.length + 1}`, isCorrect: false })}
                className="mt-2"
            >
                <Plus className="w-4 h-4 mr-2" /> Add Option
            </Button>

            {/* Display validation error for the options array (e.g., must have a correct answer) */}
            {optionError && (
                <p className="text-sm font-medium text-red-600 mt-2">
                    * {optionError}
                </p>
            )}
        </div>
    );
}

// --- MAIN COMPONENT ---
export default function AssessmentCreationPage() {
    const [isSaving, setIsSaving] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [participantSearch, setParticipantSearch] = useState("");
    const [participants, setParticipants] = useState([]);
    const [participantsError, setParticipantsError] = useState("");
    const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
    const [selectedParticipants, setSelectedParticipants] = useState(new Set());
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [view, setView] = useState('list'); // 'list' or 'builder'
    const [assessments, setAssessments] = useState([]);
    const [isLoadingAssessments, setIsLoadingAssessments] = useState(true);
    const [editingAssessment, setEditingAssessment] = useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [assessmentToDelete, setAssessmentToDelete] = useState(null);

    const form = useForm({
        resolver: zodResolver(assessmentSchema),
        defaultValues: {
            title: "Java & Spring Boot Proficiency Quiz",
            description: "Validate whether senior engineers can reason about Spring Boot internals before joining our Q4 study.",
            duration: "60",
            passingThreshold: "70",
            instructions: "Set aside quiet time. Record detailed reasoning for each choice so researchers can follow your thought process.",
            status: "draft",
            questions: [defaultQuestion],
            invitedParticipants: [],
        },
        mode: "onChange",
    });

    const { fields: questionFields, append: appendQuestion, remove: removeQuestion, replace: replaceQuestions } = useFieldArray({
        control: form.control,
        name: "questions",
    });

    const multipleChoiceQuestions = questionFields.map((field, index) => ({ field, index })).filter(({ field }) => field.type === 'multiple_choice');
    const shortAnswerQuestions = questionFields.map((field, index) => ({ field, index })).filter(({ field }) => field.type === 'short_answer');
    const questionIndexMap = useMemo(() => new Map(questionFields.map((field, index) => [field.id, index])), [questionFields]);

    const questionCount = form.watch("questions")?.length || 0;

    useEffect(() => {
        const raw = localStorage.getItem("user");
        if (!raw) {
            navigate("/login");
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed.role !== "researcher") {
                navigate("/login");
                return;
            }
            setUser(parsed);
        } catch {
            navigate("/login");
        }
    }, [navigate]);

    const fetchAssessments = async () => {
        if (!user?.id) return;
        setIsLoadingAssessments(true);
        try {
            const { data } = await api.get('/api/competency/assessments/researcher', {
                params: { researcherId: user.id }
            });
            setAssessments(data.assessments || []);
        } catch (error) {
            console.error("Failed to load assessments", error);
            alert("Could not load your assessments. Please try again later.");
        } finally {
            setIsLoadingAssessments(false);
        }
    };

    useEffect(() => {
        fetchAssessments();
    }, [user]);

    useEffect(() => {
        const fetchParticipants = async () => {
            setIsParticipantsLoading(true);
            setParticipantsError("");
            try {
                const { data } = await api.get("/api/auth/participants");
                setParticipants(data.users || []);
            } catch (error) {
                console.error("Failed to load participants", error);
                setParticipantsError(error.response?.data?.message || "Unable to load participants");
            } finally {
                setIsParticipantsLoading(false);
            }
        };
        fetchParticipants();
    }, []);

    const onSubmit = async (values, status = 'published') => {
        setIsSaving(true);
        try {
            if (!user?.id) {
                alert("Please sign in as a researcher before saving.");
                setIsSaving(false);
                return;
            }

            const payload = {
                researcherId: user.id,
                title: values.title,
                description: values.description,
                questions: values.questions.map((question) => ({
                    ...question,
                    options: question.type === "multiple_choice" ? question.options || [] : [],
                })),
                status: status,
                instructions: values.instructions,
                durationMinutes: Number(values.duration) || null,
                passingThreshold: Number(values.passingThreshold) || null,
                invitedParticipants: Array.from(selectedParticipants),
            };

            if (editingAssessment) {
                // This is an UPDATE operation
                await api.put(`/api/competency/assessments/${editingAssessment.id}`, payload);
            } else {
                // This is a CREATE operation
                await api.post("/api/competency/assessments", payload);
            }
            if (status === 'published') {
                alert("✅ Assessment Published Successfully!");
            } else {
                alert("✅ Draft Saved Successfully!");
            }
            fetchAssessments(); // Re-fetch assessments to update the list
            setView('list'); // Go back to the list view
        } catch (error) {
            console.error("Save failed:", error);
            alert("❌ Failed to save assessment. Check console for details.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = () => {
        form.handleSubmit((values) => onSubmit(values, 'draft'))();
    }

    // Placeholder handlers
    const handleGenerateAI = () => {
        setIsQuizModalOpen(true);
    };

    const handleGenerateQuiz = async (options) => {
        setIsGenerating(true);
        console.log("Generate quiz with options:", options);
        const { questionType, topic, numQuestions, numTrueFalse } = options;

        let prompt = "";
        let key = "";

        if (questionType === "multiple-choice") {
            prompt = `Generate ${numQuestions} multiple choice questions, each with ${numTrueFalse} true or false choices about: ${topic}`;
            key = "MULTIPLE_CHOICE_QUIZ_CREATION";
        } else if (questionType === "open-ended") {
            prompt = `Generate ${numQuestions} open-ended questions about: ${topic}`;
            key = "OPEN_ENDED_QUIZ_CREATION";
        }

        try {
            const response = await api.post("/api/llm", {
                prompt,
                key,
            });
            console.log("Backend response for AI generation:", response.data);
            const newQuestionsData = response.data.response;

            if (questionType === "multiple-choice") {
                newQuestionsData.forEach((q) => {
                    const newOptions = q.answers.map((ans) => ({
                        text: ans.answer,
                        isCorrect: ans.state,
                    }));
                    appendQuestion({
                        ...defaultQuestion,
                        title: q.question,
                        type: "multiple_choice",
                        options: newOptions,
                    });
                });
            } else if (questionType === "open-ended") {
                newQuestionsData.forEach((qTitle) => {
                    appendQuestion({
                        ...defaultQuestion,
                        title: qTitle,
                        type: "short_answer",
                        options: [], // Open-ended questions do not have options
                    });
                });
            }
        } catch (error) {
            console.error("Error generating quiz with AI:", error);
            alert("❌ Failed to generate questions with AI. Check console for details.");
        } finally {
            setIsGenerating(false);
            setIsQuizModalOpen(false);
        }
    };
    const handleImportQuestions = () => {
        setIsImportModalOpen(true);
    };

    const handleImportSuccess = (importedQuestions) => {
        if (importedQuestions && importedQuestions.length > 0) {
            // Use the 'replace' method from useFieldArray to update the UI
            replaceQuestions(importedQuestions);
        }
    };
    const handleDefineScoring = () => {
        alert("Define Scoring Rules: Opens a modal to set up detailed scoring/thresholds.");
    };

    const watchedDuration = form.watch("duration");
    const overviewStats = useMemo(() => {
        return [
            { label: "Status", value: editingAssessment?.status === "published" ? "Published" : "Draft", badge: editingAssessment?.status === "published" ? "default" : "secondary" },
            { label: "Questions", value: questionCount },
            { label: "Duration", value: `${watchedDuration || 0} min` },
            { label: "Invitees", value: selectedParticipants.size },
        ];
    }, [editingAssessment, questionCount, watchedDuration, selectedParticipants.size]);

    const filteredParticipants = useMemo(() => {
        if (!participantSearch.trim()) {
            return participants;
        }
        const term = participantSearch.toLowerCase();
        return participants.filter((participant) => {
            return (
                participant.name.toLowerCase().includes(term) ||
                participant.email.toLowerCase().includes(term)
            );
        });
    }, [participantSearch, participants]);

    const toggleParticipant = (participantId) => {
        setSelectedParticipants(prev => {
            const next = new Set(prev);
            if (next.has(participantId)) {
                next.delete(participantId);
            } else {
                next.add(participantId);
            }
            form.setValue("invitedParticipants", Array.from(next));
            return next;
        });
    };

    const selectAllParticipants = () => {
        const everyId = new Set(participants.map((participant) => participant.id));
        setSelectedParticipants(everyId);
        form.setValue("invitedParticipants", Array.from(everyId));
    };

    const handleCreateNew = () => {
        setEditingAssessment(null);
        form.reset({
            title: "",
            description: "",
            duration: "30",
            passingThreshold: "70",
            instructions: "",
            status: "draft",
            questions: [defaultQuestion],
            invitedParticipants: [],
        });
        setSelectedParticipants(new Set());
        setView('builder');
    };

    const handleEditDraft = (assessment) => {
        setEditingAssessment(assessment);
        form.reset({
            ...assessment,
            duration: String(assessment.criteria?.durationMinutes || 30),
            passingThreshold: String(assessment.criteria?.passingThreshold || 70),
            instructions: assessment.metadata?.instructions || "",
            invitedParticipants: assessment.metadata?.invitedParticipants || [],
        });
        setSelectedParticipants(new Set(assessment.metadata?.invitedParticipants || []));
        setView('builder');
    };

    const openDeleteDialog = (assessment) => {
        setAssessmentToDelete(assessment);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteDraft = async () => {
        if (!assessmentToDelete || !user?.id) return;
        try {
            await api.delete(`/api/competency/assessments/${assessmentToDelete.id}`, {
                data: { researcherId: user.id } // Pass researcherId for authorization
            });
            alert(`Draft "${assessmentToDelete.title}" deleted successfully.`);
            fetchAssessments(); // Refresh the list
        } catch (error) {
            console.error("Failed to delete draft", error);
            alert(error.response?.data?.message || "Could not delete the draft.");
        } finally {
            setIsDeleteDialogOpen(false);
            setAssessmentToDelete(null);
        }
    };

    const { draftAssessments, publishedAssessments } = useMemo(() => {
        const drafts = [];
        const published = [];
        assessments.forEach(a => {
            if (a.status === 'published') {
                published.push(a);
            } else {
                drafts.push(a);
            }
        });
        return { draftAssessments: drafts, publishedAssessments: published };
    }, [assessments]);

    const getQuestionCounts = (questions = []) => {
        const mc = questions.filter(q => q.type === 'multiple_choice').length;
        const sa = questions.filter(q => q.type === 'short_answer').length;
        return {
            mc,
            sa,
        };
    };

    if (view === 'list') {
        return (
            <div className="container mx-auto max-w-7xl px-4 py-6 space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">Competency Assessments</h1>
                        <p className="text-sm text-muted-foreground">Manage, create, and preview your participant quizzes.</p>
                    </div>
                    <Button onClick={handleCreateNew}><Plus className="w-4 h-4 mr-2" /> Create New Assessment</Button>
                </div>

                {/* Published Assessments */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold border-b pb-2">Published</h2>
                    {isLoadingAssessments ? <p>Loading...</p> : publishedAssessments.length === 0 ? <p className="text-sm text-muted-foreground">No published assessments yet.</p> : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {publishedAssessments.map(assessment => (
                                <Card key={assessment.id} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="truncate">{assessment.title}</CardTitle>
                                        <CardDescription>Published on {new Date(assessment.updatedAt).toLocaleDateString()}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground space-y-3 flex-grow">
                                        <div className="flex items-center gap-2">
                                            <ListChecks className="h-4 w-4" />
                                            <span>{getQuestionCounts(assessment.questions).mc} MCQs</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <span>{getQuestionCounts(assessment.questions).sa} Short Answers</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            <span>{assessment.criteria?.durationMinutes || 'N/A'} min duration</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            <span>{assessment.metadata?.invitedParticipants?.length || 0} Participants Invited</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-between">
                                        <Button variant="outline" size="sm" onClick={() => { setEditingAssessment(assessment); setIsPreviewModalOpen(true); }}>
                                            <Eye className="w-4 h-4 mr-2" /> Preview
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                {/* Draft Assessments */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold border-b pb-2">Drafts</h2>
                    {isLoadingAssessments ? <p>Loading...</p> : draftAssessments.length === 0 ? <p className="text-sm text-muted-foreground">No drafts. Click 'Create New' to start.</p> : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {draftAssessments.map(assessment => (
                                <Card key={assessment.id} className="flex flex-col">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <CardTitle className="truncate pr-2">{assessment.title}</CardTitle>
                                                <CardDescription>Last updated: {new Date(assessment.updatedAt).toLocaleDateString()}</CardDescription>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditDraft(assessment)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openDeleteDialog(assessment)} className="text-red-600">Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-sm text-muted-foreground space-y-3 flex-grow">
                                        <div className="flex items-center gap-2"><ListChecks className="h-4 w-4" /><span>{getQuestionCounts(assessment.questions).mc} MCQs</span></div>
                                        <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span>{getQuestionCounts(assessment.questions).sa} Short Answers</span></div>
                                        <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><span>{assessment.criteria?.durationMinutes || 'N/A'} min duration</span></div>
                                        <div className="flex items-center gap-2"><Users className="h-4 w-4" /><span>{assessment.metadata?.invitedParticipants?.length || 0} Participants</span></div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end">
                                        <Button size="sm" onClick={() => handleEditDraft(assessment)}>Edit Draft</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
                <AssessmentPreviewModal
                    isOpen={isPreviewModalOpen}
                    onClose={() => setIsPreviewModalOpen(false)}
                    assessmentData={editingAssessment}
                />
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to delete this draft?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the draft assessment titled "{assessmentToDelete?.title}". This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteDraft} className="bg-red-600 hover:bg-red-700">
                                Yes, Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">{editingAssessment ? "Edit Assessment" : "Create New Assessment"}</h1>
                    <p className="text-sm text-muted-foreground">
                        Design quizzes to gate studies and evaluate participant readiness.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" onClick={() => setView('list')}>
                        &larr; Back to Assessments
                    </Button>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                        <div className="space-y-6">

                            {/* --- ASSESSMENT METADATA (Title, Duration, Threshold) --- */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Assessment overview</CardTitle>
                                    <CardDescription>Title, description, and scoring rules participants will see.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">

                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Assessment Title</FormLabel>
                                                <FormControl><Input placeholder="e.g., Java & Spring Boot Proficiency Quiz" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Short description</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={3} placeholder="Explain what this competency check measures..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                                        <FormField
                                            control={form.control}
                                            name="duration"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className="flex items-center"><Clock className="w-4 h-4 mr-2" />Duration (minutes)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="60" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="passingThreshold"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className="flex items-center"><TrendingUp className="w-4 h-4 mr-2" />Passing Threshold (%)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="70" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="instructions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Participant instructions</FormLabel>
                                                <FormControl>
                                                    <Textarea rows={4} placeholder="Provide context, expectations, and submission guidelines" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="button" variant="outline" className="w-full" onClick={handleDefineScoring}>
                                        Define detailed scoring rules
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* --- QUESTION BUILDER SECTION --- */}
                            <Card>
                                <CardHeader><CardTitle>Questions editor</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    {/* --- MULTIPLE CHOICE SECTION --- */}
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Multiple Choice Questions</h3>
                                        {multipleChoiceQuestions.map(({ field: qField, index: qIndex }, displayIndex) => (
                                            <div key={qField.id} className="border p-4 rounded-lg space-y-4 bg-gray-50/50">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-gray-700">Question {displayIndex + 1}</h4>
                                                    <Button type="button" variant="destructive" size="sm" onClick={() => removeQuestion(qIndex)}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </Button>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`questions.${qIndex}.title`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Question Title</FormLabel>
                                                            <FormControl><Textarea placeholder="What is Dependency Injection?" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Separator />
                                                <h5 className="font-semibold">Options (Select one or more 'Correct' options)</h5>
                                                <OptionsFieldArray
                                                    questionIndex={qIndex}
                                                    control={form.control}
                                                    errors={form.formState.errors}
                                                />
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center mt-4">
                                            <Button type="button" onClick={() => appendQuestion(defaultQuestion)}>
                                                <Plus className="w-4 h-4 mr-2" /> Add Multiple Choice Question
                                            </Button>
                                            {multipleChoiceQuestions.length === 0 && (
                                                <p className="text-sm text-muted-foreground">No multiple choice questions yet.</p>
                                            )}
                                        </div>
                                    </div>

                                    <Separator className="my-8" />

                                    {/* --- SHORT ANSWER SECTION --- */}
                                    <div className="space-y-4">
                                        <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">Short Answer Questions</h3>
                                        {shortAnswerQuestions.map(({ field: qField, index: qIndex }, displayIndex) => (
                                            <div key={qField.id} className="border p-4 rounded-lg space-y-4 bg-gray-50/50">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-lg font-semibold text-gray-700">Question {displayIndex + 1}</h4>
                                                    <Button type="button" variant="destructive" size="sm" onClick={() => removeQuestion(qIndex)}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                    </Button>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`questions.${qIndex}.title`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Question Prompt</FormLabel>
                                                            <FormControl><Textarea placeholder="Describe a situation where you would use a Singleton pattern." {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="rounded-md bg-white p-3 text-sm text-muted-foreground">
                                                    Participants will respond with a short paragraph. Scoring for these questions is manual.
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center mt-4">
                                            <Button type="button" onClick={() => appendQuestion(defaultShortAnswerQuestion)}>
                                                <Plus className="w-4 h-4 mr-2" /> Add Short Answer Question
                                            </Button>
                                            {shortAnswerQuestions.length === 0 && (
                                                <p className="text-sm text-muted-foreground">No short answer questions yet.</p>
                                            )}
                                        </div>
                                    </div>

                                    <Separator className="my-8" />

                                    {/* --- GLOBAL ACTIONS --- */}
                                    <div className="flex flex-col sm:flex-row justify-between mt-6 space-y-3 sm:space-y-0">
                                        <p className="text-sm text-muted-foreground">
                                            You can also import a question bank or generate questions with AI.
                                        </p>
                                        <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={handleImportQuestions}>
                                        <Upload className="w-4 h-4 mr-2" /> Import Questions
                                    </Button>
                                <Button type="button" variant="secondary" onClick={handleGenerateAI}>
                                    <Zap className="w-4 h-4 mr-2" /> Generate with AI
                                </Button>
                                        </div>
                            </div>

                        </CardContent>
                    </Card>

                            {/* --- SAVE BUTTON --- */}
                            <div className="flex flex-wrap justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                                    Save draft
                                </Button>
                                <Button type="submit" size="lg" disabled={isSaving} onClick={form.handleSubmit((values) => onSubmit(values, 'published'))}>
                                    <Save className="w-5 h-5 mr-2" />
                                    {isSaving ? "Saving Template..." : "Save & Publish"}
                                </Button>
                            </div>
                            {form.formState.errors.questions && (
                                <p className="text-sm font-medium text-red-600 mt-2">
                                    * Please correct errors in the questions above before saving.
                                </p>
                            )}
                        </div>

                        <aside className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Assessment summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {overviewStats.map((stat) => (
                                        <div key={stat.label} className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">{stat.label}</span>
                                            {stat.badge ? (
                                                <Badge variant={stat.badge === "default" ? "default" : "secondary"}>
                                                    {stat.value}
                                                </Badge>
                                            ) : (
                                                <span className="font-medium text-foreground">{stat.value}</span>
                                            )}
                                        </div>
                                    ))}
                                    <Separator />
                                    <div className="text-xs text-muted-foreground">
                                        Tip: publish the assessment to make it available in the study wizard and participant assignments.
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Preview & assets</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm text-muted-foreground">
                                    <p className="flex items-center gap-2">
                                        <Eye className="h-4 w-4" />
                                        Use participant preview to confirm instructions look correct.
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Layers className="h-4 w-4" />
                                        Attach sample artifacts or reference material once saved.
                                    </p>
                                    <Button type="button" variant="outline" className="w-full" onClick={() => setIsPreviewModalOpen(true)}>
                                        Open preview mode
                                    </Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Participants directory</CardTitle>
                                    <CardDescription>Select who should receive this competency quiz.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Users className="h-4 w-4" />
                                            {isParticipantsLoading
                                                ? "Loading..."
                                                : `${selectedParticipants.length} selected`}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={selectAllParticipants}
                                            disabled={!participants.length}
                                        >
                                            Select all
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={participantSearch}
                                            onChange={(event) => setParticipantSearch(event.target.value)}
                                            placeholder="Search by name or email"
                                            className="border-0 focus-visible:ring-0"
                                            disabled={!participants.length}
                                        />
                                    </div>
                                    {participantsError ? (
                                        <p className="text-xs text-destructive">{participantsError}</p>
                                    ) : null}
                                    <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-md border p-2">
                                        {isParticipantsLoading ? (
                                            <p className="py-6 text-center text-xs text-muted-foreground">Fetching participants…</p>
                                        ) : filteredParticipants.length ? (
                                            filteredParticipants.map((participant) => (
                                                <div
                                                    key={participant.id}
                                                    className={`rounded-md border p-3 text-sm ${selectedParticipants.has(participant.id) ? "border-primary bg-primary/5" : "border-muted"}`}
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold text-foreground">{participant.name}</p>
                                                                <p className="text-xs text-muted-foreground">{participant.email}</p>
                                                            </div>
                                                            <Checkbox
                                                                checked={selectedParticipants.has(participant.id)}
                                                                onCheckedChange={() => toggleParticipant(participant.id)}
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                            <span>{participant.role || "participant"}</span>
                                                            <span>
                                                                Joined{" "}
                                                                {participant.created_at
                                                                    ? new Date(participant.created_at).toLocaleDateString()
                                                                    : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-xs text-muted-foreground py-6">
                                                No participants match this search.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                </form>
            </Form>
            {/* Quiz Generation Modal */}
            <QuizGenerationModal
                isOpen={isQuizModalOpen}
                onClose={() => setIsQuizModalOpen(false)}
                onGenerate={handleGenerateQuiz}
                isGenerating={isGenerating}
            />
            {/* Import Questions Modal */}
            <QuestionImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={handleImportSuccess}
            />
            <AssessmentPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                assessmentData={editingAssessment || form.getValues()}
            />
        </div>
    );
}
