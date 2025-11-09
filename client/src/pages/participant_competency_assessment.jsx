// src/pages/ParticipantCompetencyAssessment.jsx

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Assuming axios is imported in your App or installed if needed for the API call
// import axios from 'axios'; 

// --- SHADCN/UI COMPONENTS ---
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// --- ZOD SCHEMA (Form Validation) ---
// Define the structure and validation rules for your form data
const formSchema = z.object({
  programmingExperience: z.string({
    required_error: "Please select your programming experience.",
  }),
  reactDefinition: z.string({
    required_error: "Please select an answer for Question 1.",
  }),
  umlPurpose: z.string({
    required_error: "Please select an answer for Question 2.",
  }),
});


export default function ParticipantCompetencyAssessment() {
    
    // --- STATE AND HOOKS ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const assessmentDeadline = "October 30th, 2025 at 23:59 PST"; // Placeholder
    
    // Initialize react-hook-form
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            programmingExperience: "",
            reactDefinition: "",
            umlPurpose: "",
        },
    });

    // --- SUBMISSION HANDLER ---
    // Note: This function is triggered by the AlertDialogAction, not the form directly.
    const onSubmit = async (values) => {
        setIsSubmitting(true);
        console.log("Submitting values:", values);
        
        try {
            // 🛑 Replace this with your actual API call
            // await axios.post('/api/assessment/submit', values);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay
            
            alert("Assessment submitted successfully!");
            // TODO: navigate('/dashboard') or similar on success

        } catch (error) {
            console.error("Submission failed:", error);
            alert("Submission failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="p-6 md:p-10 max-w-4xl mx-auto">
            
            <h1 className="text-3xl font-bold mb-6">Competency Assessment Page</h1>

            <Form {...form}>
                {/* We use form.handleSubmit here to run validation BEFORE showing the dialog */}
                <form onSubmit={form.handleSubmit(() => document.getElementById('submission-trigger').click())}> 
                    <Card>
                        <CardHeader>
                            <CardTitle>Competency Assessment</CardTitle>
                            <div className="text-sm font-semibold text-red-600">
                                🛑 DUE DATE: {assessmentDeadline}
                            </div>
                            <p className="text-sm text-muted-foreground">Please complete to qualify for studies.</p>
                        </CardHeader>
                        
                        <CardContent className="space-y-8">
                            
                            {/* --------------------------------------------------- */}
                            {/* PART 1: Background Questionnaire (Multiple Choice) */}
                            {/* --------------------------------------------------- */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Part 1: Background Questionnaire</h2>
                                <Separator />
                                
                                {/* Question 1: Years of Experience */}
                                <FormField
                                    control={form.control}
                                    name="programmingExperience"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="font-medium">How many years of professional programming experience do you have?</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="flex space-x-4"
                                                >
                                                    {['0-1', '1-3', '3-5', '5+'].map((value) => (
                                                        <FormItem key={value} className="flex items-center space-x-2">
                                                            <FormControl>
                                                                <RadioGroupItem value={value} id={`exp-${value}`} />
                                                            </FormControl>
                                                            <FormLabel htmlFor={`exp-${value}`} className="font-normal">{value}</FormLabel>
                                                        </FormItem>
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </section>

                            {/* --------------------------------------------------- */}
                            {/* PART 2: Technical Quiz (Multiple Choice Only) */}
                            {/* --------------------------------------------------- */}
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold">Part 2: Technical Quiz</h2>
                                <Separator />

                                {/* Question 1: What is a "React hook"? */}
                                <FormField
                                    control={form.control}
                                    name="reactDefinition"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="font-medium">1. What is a "React hook"?</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="space-y-2"
                                                >
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl>
                                                            <RadioGroupItem value="A function that lets you use state and other React features without writing a class." id="q1-function" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="q1-function" className="font-normal">A function that lets you use state and other React features without writing a class.</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl>
                                                            <RadioGroupItem value="A type of functional component." id="q1-component" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="q1-component" className="font-normal">A type of functional component.</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Question 2: Purpose of UML class diagram? */}
                                <FormField
                                    control={form.control}
                                    name="umlPurpose"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="font-medium">2. What is the purpose of a "UML class diagram"?</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="space-y-2"
                                                >
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl>
                                                            <RadioGroupItem value="visualize_db" id="q2-db" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="q2-db" className="font-normal">To visualize the structure of a database.</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl>
                                                            <RadioGroupItem value="structure_system" id="q2-structure" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="q2-structure" className="font-normal">To show the structure of a system, including its classes, attributes, and relationships.</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2">
                                                        <FormControl>
                                                            <RadioGroupItem value="process_flow" id="q2-process" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="q2-process" className="font-normal">To document the step-by-step process flow of a user interaction.</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </section>
                        </CardContent>

                        {/* --------------------------------------------------- */}
                        {/* Submission Button & Confirmation Dialog */}
                        {/* --------------------------------------------------- */}
                        <CardFooter className="flex justify-end pt-6">
                            <AlertDialog>
                                {/* This Button is hidden and used ONLY to trigger the dialog after validation passes */}
                                <AlertDialogTrigger asChild>
                                    <Button id="submission-trigger" type="button" className="hidden" />
                                </AlertDialogTrigger>
                                
                                {/* The visible button submits the form for validation */}
                                <Button type="submit" disabled={isSubmitting}> 
                                    Submit Assessment
                                </Button>

                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            You will not be able to change your answers after submission. 
                                            Please ensure you have answered all questions.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        
                                        {/* This button runs the actual API submission logic */}
                                        <AlertDialogAction onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                                            {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}