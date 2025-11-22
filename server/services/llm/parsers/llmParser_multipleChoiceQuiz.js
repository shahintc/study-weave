export function parse(llmResponse) {
    if (!llmResponse || typeof llmResponse !== 'string') {
        return null;
    }

    const lines = llmResponse.trim().split('\n')

    const questions = [];
    let currentQuestion = {};
    let firstQuestion = false;

    for (const line of lines){
        const trimmedLine = line.trim()
        if (!trimmedLine){
            continue;
        }

        const parts = trimmedLine.split(/:\s*/, 2);

        if (parts.length < 2) {
            console.warn(`Skipping line with invalid format: ${trimmedLine}`);
            continue;
        }

        const identifier = parts[0].toUpperCase();
        const text = parts[1].trim();

        switch (identifier) {
            case 'Q':
                if (!firstQuestion) {
                    firstQuestion = true;
                } else {
                    if (currentQuestion.question.length > 0 && currentQuestion.answers.length > 0) {
                        questions.push(currentQuestion);
                    } else {
                        console.log("Question incomplete: skipping")
                    }
                }
                currentQuestion = {
                    question: text,
                    answers: []
                }
                break;

            case 'T':
                currentQuestion.answers.push({
                    answer: text,
                    state: true
                })
                break;

            case 'F':
                currentQuestion.answers.push({
                    answer: text,
                    state: false
                })
                break;

            default:
                console.log(`Unrecognized identifier: ${identifier} skipping line`);


        }
    }

    if (currentQuestion.question.length > 0 && currentQuestion.answers.length > 0){
        questions.push(currentQuestion);
    } else {
        console.log("Question incomplete: skipping")
    }

    return questions;
}
