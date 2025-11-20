import Artifact from "../../../models/Artifact.js";

export async function getContent(artifactId){
    console.log(`Fetching content for artifact: ${artifactId}`)
    const artifact = await Artifact.findArtifactById(artifactId);
    console.log(`Fetched artifact: ${artifact.filePath}`)

    if (!artifact) {
        console.log(`Error: Artifact with ID ${artifactId} not found.`)
        return null;
    }

    if (!artifact.filePath || !artifact.fileMimeType){
        console.log('Error: artifact file path/type information incomplete')
    }

    console.log(`Artifact fetched: ${artifact.fileMimeType}`)

    return {
        filepath: artifact.filePath,
        mime: artifact.fileMimeType
    };
}
