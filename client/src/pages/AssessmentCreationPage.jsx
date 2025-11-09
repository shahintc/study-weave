import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Save, Upload, Zap, Clock, TrendingUp } from 'lucide-react';

// --- SHADCN/UI COMPONENTS ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
// removed page-level header/nav; layout provides them


// --- ZOD SCHEMA (Assessment Builder) ---
const optionSchema = z.object({
  text: z.string().min(1, { message: "Option text cannot be empty." }),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  title: z.string().min(1, { message: "Question title is required." }),
  type: z.enum(["multiple_choice"]),
  options: z.array(optionSchema).min(2, { message: "Must have at least 2 options." }),
}).refine(
  (data) => data.options.some((option) => option.isCorrect),
  {
    message: "At least one option must be marked as correct.",
    path: ["options"],
  }
);

const assessmentSchema = z.object({
  title: z.string().min(5, { message: "Assessment title must be at least 5 characters." }),
  duration: z.string().regex(/^\d+$/, { message: "Duration must be a number (in minutes)." }),
  passingThreshold: z.string().regex(/^\d+$/, { message: "Threshold must be a number (percentage)." }),
  questions: z.array(questionSchema).min(1, { message: "An assessment must have at least one question." }),
});

// Default initial question for a clean start
const defaultQuestion = { title: "", type: "multiple_choice", options: [{ text: "Option A", isCorrect: false }, { text: "Option B", isCorrect: true }] };


// header/nav removed


// --- Dynamic Options Component ---
// Separated component for managing options within a specific question
function OptionsFieldArray({ questionIndex, control }) {
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

    // Access the form state to manually display errors
    const { formState: { errors } } = useForm({ control });

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
            {errors.questions?.[questionIndex]?.options?.message && (
                <p className="text-sm font-medium text-red-600 mt-2">
                    * {errors.questions[questionIndex].options.message}
                </p>
            )}
        </div>
    );
}

// --- MAIN COMPONENT ---
export default function AssessmentCreationPage() {
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm({
        resolver: zodResolver(assessmentSchema),
        defaultValues: {
            title: "Java & Spring Boot Proficiency Quiz",
            duration: "60",
            passingThreshold: "70",
            questions: [defaultQuestion],
        },
        mode: "onChange",
    });

    const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
        control: form.control,
        name: "questions",
    });

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


    return (
        <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
            {/* header/nav provided by layout */}

            <h1 className="text-3xl font-bold">Competency Assessment Creation Page</h1>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    
                    {/* --- ASSESSMENT METADATA (Title, Duration, Threshold) --- */}
                    <Card>
                        <CardHeader><CardTitle>Assessment Builder Details</CardTitle></CardHeader>
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
                            
                            <Button type="button" variant="outline" className="w-full" onClick={handleDefineScoring}>
                                Define Scoring Rules & Thresholds
                            </Button>
                        </CardContent>
                    </Card>

                    {/* --- QUESTION BUILDER SECTION --- */}
                    <Card>
                        <CardHeader><CardTitle>Questions Editor</CardTitle></CardHeader>
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
                                    <p className="text-sm text-gray-500">Type: Multiple Choice</p>
                                    
                                    <Separator />
                                    <h4 className="font-semibold mt-4">Options (Select one or more 'Correct' options)</h4>

                                    {/* Dynamic Options List Component */}
                                    <OptionsFieldArray questionIndex={qIndex} control={form.control} />
                                    
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
                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" disabled={isSaving}>
                            <Save className="w-5 h-5 mr-2" />
                            {isSaving ? "Saving Template..." : "Save Assessment Template"}
                        </Button>
                    </div>
                    {form.formState.errors.questions && (
                        <p className="text-sm font-medium text-red-600 mt-2">
                            * Please correct errors in the questions above before saving.
                        </p>
                    )}
                </form>
            </Form>
        </div>
    );
}
