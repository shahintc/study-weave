import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Loader2 } from 'lucide-react';

export const QuizGenerationModal = ({ isOpen, onClose, onGenerate, isGenerating }) => {
    const [questionType, setQuestionType] = useState('multiple-choice');
    const [topic, setTopic] = useState('');
    const [numQuestions, setNumQuestions] = useState(1);
    const [numTrueFalse, setNumTrueFalse] = useState(0);

    const handleGenerate = () => {
        onGenerate({ questionType, topic, numQuestions, numTrueFalse });
    };

    return (
        <Dialog open={isOpen} onOpenChange={!isGenerating ? onClose : () => {}}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generate Quiz with AI</DialogTitle>
                    <DialogDescription>
                        Configure your quiz generation settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="questionType" className="text-right">
                            Question Type
                        </Label>
                        <RadioGroup
                            value={questionType}
                            onValueChange={setQuestionType}
                            className="flex col-span-3 gap-2"
                        >
                            <div
                                className={`flex-1 flex items-center justify-center p-2 border rounded-md cursor-pointer
                                ${questionType === 'multiple-choice'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                                }`}
                                onClick={() => setQuestionType('multiple-choice')}
                            >
                                <RadioGroupItem value="multiple-choice" id="multiple-choice" className="sr-only" />
                                <Label htmlFor="multiple-choice" className="cursor-pointer">
                                    Multiple Choice
                                </Label>
                            </div>
                            <div
                                className={`flex-1 flex items-center justify-center p-2 border rounded-md cursor-pointer
                                ${questionType === 'open-ended'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                                }`}
                                onClick={() => setQuestionType('open-ended')}
                            >
                                <RadioGroupItem value="open-ended" id="open-ended" className="sr-only" />
                                <Label htmlFor="open-ended" className="cursor-pointer">
                                    Open-ended
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="topic" className="text-right">
                            Topic
                        </Label>
                        <Input
                            id="topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g., React Hooks"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="numQuestions" className="text-right">
                          How many questions?
                        </Label>
                        <Input
                            id="numQuestions"
                            type="number"
                            value={numQuestions}
                            onChange={(e) => setNumQuestions(Number(e.target.value))}
                            className="col-span-3"
                            min="1"
                        />
                    </div>

                    {questionType === 'multiple-choice' && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="numTrueFalse" className="text-right">
                              How many choices for each?
                            </Label>
                            <Input
                                id="numTrueFalse"
                                type="number"
                                value={numTrueFalse}
                                onChange={(e) => setNumTrueFalse(Number(e.target.value))}
                                className="col-span-3"
                                min="0"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="outline" disabled={isGenerating}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating || !topic || numQuestions < 1}>
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
