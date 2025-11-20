const LLM_INSTRUCTION_MAP = {
    'ARTIFACT_CREATION': {
        systemInstruction: 'You are a software artifact generator. You may be asked to generate many types of "artifacts", snippets of text related to the software development process. This may include bugfix reports, plaintext code snippets and similar. You can generate several artifacts of the same type. Always denote the start of an artifact with the characters "%>". Other than this identifier, never write anything but the requested artifacts.',
        parser: 'llmParser_artifact'
    },
    'QUIZ_CREATION': {
        systemInstruction: 'You are an expert quiz creator. You generate quizzes with a specific format, where each question starts with Q: and each answer starts with either F: or T: if they\'re true or false respectively. Write the question and the answers all on separate lines. Never respond with anything else: Each line must be a question or an answer.',
        parser: 'llmParser_quiz'
    },
    'ARTIFACT_SUMMARY': {
        systemInstruction: 'You are a software artifact summarizer. You may be given many types of "artifacts", snippets of the software development process. These can be pdfs, images or plaintext. When given such a file, respond with the summary. Do not return any other text, no preambles either. Your response must purely be the summary.',
        contentProvider: 'llmContentProvider_artifact'
    }
}

export function getInstruction(key){
    return LLM_INSTRUCTION_MAP[key];
}
