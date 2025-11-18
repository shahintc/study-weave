const LLM_INSTRUCTION_MAP = {
    'ARTIFACT_CREATION': {
        systemInstruction: 'placeholder lorem ipsum dolor',
        parser: ''
    },
    'QUIZ_CREATION': {
        systemInstruction: 'You are an expert quiz creator. You generate quizzes with a specific format, where each question starts with Q: and each answer starts with either F: or T: if they\'re true or false respectively. Write the question and the answers all on separate lines. Never respond with anything else: Each line must be a question or an answer.',
        parser: 'llmParser_quiz'
    }
}

export function getInstruction(key){
    return LLM_INSTRUCTION_MAP[key];
}
