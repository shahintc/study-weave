import React, { useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Save, Upload, Zap, Clock, TrendingUp, Eye, Layers, Users, Search } from 'lucide-react';

// --- SHADCN/UI COMPONENTS ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  description: z.string().min(20, { message: "Provide a short description (20+ chars)." }),
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
    const [participantSearch, setParticipantSearch] = useState("");
    const [selectedParticipants, setSelectedParticipants] = useState([1, 3]);

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
            invitedParticipants: [1, 3],
        },
        mode: "onChange",
    });

    const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
        control: form.control,
        name: "questions",
    });
    const status = form.watch("status");
    const questionCount = form.watch("questions")?.length || 0;

    const onSubmit = async (values) => {
        setIsSaving(true);
        console.log("Saving Assessment Template:", values);
        
        try {
            // 🛑 Replace with your actual API call
            // await axios.post('/api/researcher/assessment', values);
            await new Promise(resolve => setTimeout(resolve, 2000));
            alert("✅ Assessment Template Saved Successfully!");
            // TODO: Navigate or clear form
        } catch (error) {
            console.error("Save failed:", error);
            alert("❌ Failed to save assessment. Check console for details.");
        } finally {
            setIsSaving(false);
        }
    };
    
    // Placeholder handlers
    const handleGenerateAI = () => {
        alert("AI Generation Feature: Opens a dialog to input topic/prompt.");
    };
    const handleImportQuestions = () => {
        alert("Import Questions Feature: Opens file upload or paste dialog.");
    };
    const handleDefineScoring = () => {
        alert("Define Scoring Rules: Opens a modal to set up detailed scoring/thresholds.");
    };

    const overviewStats = useMemo(() => {
        return [
            { label: "Status", value: status === "published" ? "Published" : "Draft", badge: status === "published" ? "default" : "secondary" },
            { label: "Questions", value: questionCount },
            { label: "Duration", value: `${form.watch("duration") || 0} min` },
            { label: "Invitees", value: selectedParticipants.length },
        ];
    }, [status, questionCount, form, selectedParticipants.length]);

    const filteredParticipants = useMemo(() => {
        if (!participantSearch.trim()) {
            return PARTICIPANT_DIRECTORY;
        }
        const term = participantSearch.toLowerCase();
        return PARTICIPANT_DIRECTORY.filter((participant) => {
            return (
                participant.name.toLowerCase().includes(term) ||
                participant.email.toLowerCase().includes(term) ||
                participant.persona.toLowerCase().includes(term)
            );
        });
    }, [participantSearch]);

    const toggleParticipant = (participantId) => {
        setSelectedParticipants((prev) =>
            prev.includes(participantId)
                ? prev.filter((id) => id !== participantId)
                : [...prev, participantId],
        );
        form.setValue(
            "invitedParticipants",
            selectedParticipants.includes(participantId)
                ? selectedParticipants.filter((id) => id !== participantId)
                : [...selectedParticipants, participantId],
        );
    };

    const selectAllParticipants = () => {
        const everyId = PARTICIPANT_DIRECTORY.map((participant) => participant.id);
        setSelectedParticipants(everyId);
        form.setValue("invitedParticipants", everyId);
    };


    return (
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Competency Assessment Builder</h1>
                    <p className="text-sm text-muted-foreground">
                        Design quizzes to gate studies and evaluate participant readiness.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleGenerateAI}>
                        <Zap className="w-4 h-4 mr-2" /> Suggest questions
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleImportQuestions}>
                        <Upload className="w-4 h-4 mr-2" /> Import bank
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
                                    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <FormField
                                            control={form.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem className="w-full sm:w-1/2">
                                                    <FormLabel>Assessment status</FormLabel>
                                                    <Select value={field.value} onValueChange={field.onChange}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Choose status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="draft">Draft</SelectItem>
                                                            <SelectItem value="published">Published</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <div className="text-sm text-muted-foreground">
                                            Toggle to published when you are ready to assign this quiz to participants.
                                        </div>
                                    </div>
                                    <Button type="button" variant="outline" className="w-full" onClick={handleDefineScoring}>
                                        Define detailed scoring rules
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* --- QUESTION BUILDER SECTION --- */}
                            <Card>
                                <CardHeader><CardTitle>Questions editor</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                            
                            {/* Dynamic Question List */}
                            {questionFields.map((qField, qIndex) => (
                                <div key={qField.id} className="border p-4 rounded-lg space-y-4 bg-gray-50/50">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold text-gray-700">Question {qIndex + 1}</h3>
                                        <Button 
                                            type="button" 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={() => removeQuestion(qIndex)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete Q
                                        </Button>
                                    </div>
                                    
                                    {/* Question Title */}
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
                                    <FormField
                                        control={form.control}
                                        name={`questions.${qIndex}.type`}
                                        render={({ field }) => (
                                            <FormItem className="w-full sm:w-1/2">
                                                <FormLabel>Response type</FormLabel>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                                                        <SelectItem value="short_answer">Short answer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <p className="text-sm text-gray-500">
                                        {form.watch(`questions.${qIndex}.type`) === "short_answer"
                                            ? "Participants will write a free-form response; scoring is manual."
                                            : "Set at least two options and mark the correct ones."}
                                    </p>
                                    <Separator />
                                    {form.watch(`questions.${qIndex}.type`) === "multiple_choice" ? (
                                        <>
                                            <h4 className="font-semibold mt-4">Options (Select one or more 'Correct' options)</h4>
                                            <OptionsFieldArray
                                                questionIndex={qIndex}
                                                control={form.control}
                                                errors={form.formState.errors}
                                            />
                                        </>
                                    ) : (
                                        <div className="rounded-md bg-white p-3 text-sm text-muted-foreground">
                                            Participants will respond with a short paragraph. Encourage them to provide detailed reasoning.
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Question Actions */}
                            <div className="flex flex-col sm:flex-row justify-between mt-6 space-y-3 sm:space-y-0">
                                <div className="space-x-2">
                                    <Button type="button" onClick={() => appendQuestion(defaultQuestion)}>
                                        <Plus className="w-4 h-4 mr-2" /> Add New Question
                                    </Button>
                                    <Button type="button" variant="outline" onClick={handleImportQuestions}>
                                        <Upload className="w-4 h-4 mr-2" /> Import Questions
                                    </Button>
                                </div>
                                <Button type="button" variant="secondary" onClick={handleGenerateAI}>
                                    <Zap className="w-4 h-4 mr-2" /> Generate with AI
                                </Button>
                            </div>
                            
                        </CardContent>
                    </Card>

                            {/* --- SAVE BUTTON --- */}
                            <div className="flex flex-wrap justify-end gap-3 pt-4">
                                <Button type="button" variant="outline">
                                    Save draft
                                </Button>
                                <Button type="submit" size="lg" disabled={isSaving}>
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
                                    <Button type="button" variant="outline" className="w-full">
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
                                            {selectedParticipants.length} selected
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={selectAllParticipants}>
                                            Select all
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={participantSearch}
                                            onChange={(event) => setParticipantSearch(event.target.value)}
                                            placeholder="Search by name, email, persona"
                                            className="border-0 focus-visible:ring-0"
                                        />
                                    </div>
                                    <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-md border p-2">
                                        {filteredParticipants.map((participant) => (
                                            <div
                                                key={participant.id}
                                                className={`rounded-md border p-3 text-sm ${selectedParticipants.includes(participant.id) ? "border-primary bg-primary/5" : "border-muted"}`}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold text-foreground">{participant.name}</p>
                                                            <p className="text-xs text-muted-foreground">{participant.email} • {participant.persona}</p>
                                                        </div>
                                                        <Checkbox
                                                            checked={selectedParticipants.includes(participant.id)}
                                                            onCheckedChange={() => toggleParticipant(participant.id)}
                                                        />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                        <span>{participant.location}</span>
                                                        <span>{participant.completedStudies} studies</span>
                                                        <span>Last score {participant.lastScore}%</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">Last study: {participant.lastStudy}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {!filteredParticipants.length ? (
                                            <p className="text-center text-xs text-muted-foreground py-6">No participants match this search.</p>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                </form>
            </Form>
        </div>
    );
}
const PARTICIPANT_DIRECTORY = [
  {
    id: 1,
    name: "Ava Mayer",
    email: "ava@example.com",
    role: "participant",
    persona: "Senior Engineer",
    location: "Berlin",
    lastStudy: "API Quality Bench",
    lastScore: 82,
    completedStudies: 5,
  },
  {
    id: 2,
    name: "Noah Singh",
    email: "noah@example.com",
    role: "participant",
    persona: "Bootcamp Grad",
    location: "Toronto",
    lastStudy: "Prototype UX Sprint",
    lastScore: 68,
    completedStudies: 2,
  },
  {
    id: 3,
    name: "Lina Patel",
    email: "lina@example.com",
    role: "participant",
    persona: "Design Partner",
    location: "Austin",
    lastStudy: "LLM Feedback Lab",
    lastScore: 90,
    completedStudies: 7,
  },
  {
    id: 4,
    name: "Mia Chen",
    email: "mia@example.com",
    role: "participant",
    persona: "Senior Engineer",
    location: "Singapore",
    lastStudy: "Security Review Pilot",
    lastScore: 75,
    completedStudies: 4,
  },
  {
    id: 5,
    name: "Leo Martins",
    email: "leo@example.com",
    role: "participant",
    persona: "Design Partner",
    location: "Lisbon",
    lastStudy: "Onboarding Diary",
    lastScore: 88,
    completedStudies: 6,
  },
];
