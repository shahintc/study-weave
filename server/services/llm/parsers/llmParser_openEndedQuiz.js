export function parse(llmResponse) {
  if (!llmResponse || typeof llmResponse !== 'string') {
      return null;
  }

  const rawQuestions = llmResponse.trim().split('Q:')
  const questions = [];

  for (const q of rawQuestions){
    const trimmed = q.trim()
    if (!trimmed){
      continue;
    }

    questions.push(trimmed);
  }

  return questions;
}
