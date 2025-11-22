export function parse(llmResponse) {
    if (!llmResponse || typeof llmResponse !== 'string'){
        return null;
    }

    const artifacts = [];
    const rawArtifacts = llmResponse.trim().split('%>');

    for (const rawArtifact of rawArtifacts){
        const trimmed = rawArtifact.trim();

        //Skip if text is just whitespaces
        if (!trimmed){
            continue;
        }

        artifacts.push(trimmed);
    }

    return artifacts;
}
