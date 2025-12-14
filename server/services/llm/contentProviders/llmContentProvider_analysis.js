import Artifact from "../../../sequelize-models/artifact.js";
import Evaluation from "../../../sequelize-models/evaluation.js"; // Import the Evaluation model

export async function getContent(evaluationId) {
  try {
    // a) Fetch the evaluation with that id
    const evaluation = await Evaluation.findByPk(evaluationId);

    if (!evaluation) {
      throw new Error(`Evaluation with ID ${evaluationId} not found`);
    }

    // Initialize an array to hold all artifact IDs
    let allArtifactIds = [];

    // Check participantPayload.left.artifactId
    const leftArtifactId = evaluation.participantPayload?.left?.artifactId;
    if (typeof leftArtifactId === 'number') {
      allArtifactIds.push(leftArtifactId);
    }

    // Check participantPayload.right.artifactId
    const rightArtifactId = evaluation.participantPayload?.right?.artifactId;
    if (typeof rightArtifactId === 'number') {
      allArtifactIds.push(rightArtifactId);
    }

    // b) Look at Evaluation.participantPayload.customArtifacts (a list of objects, each with an artifact id)
    const customArtifactsPayload = evaluation.participantPayload?.customArtifacts;

    if (customArtifactsPayload && Array.isArray(customArtifactsPayload) && customArtifactsPayload.length > 0) {
      const customArtifactIds = customArtifactsPayload
        .map(item => item.artifactId)
        .filter(id => typeof id === 'number');
      allArtifactIds = allArtifactIds.concat(customArtifactIds);
    }

    // Ensure unique artifact IDs
    allArtifactIds = [...new Set(allArtifactIds)];

    if (allArtifactIds.length === 0) {
      console.warn(`No valid artifact IDs found in participantPayload for Evaluation ID ${evaluationId}`);
      return [];
    }

    // c) Fetch all the artifacts with these ids
    const artifacts = await Artifact.findAll({
      where: {
        id: allArtifactIds
      }
    });

    if (artifacts.length === 0) {
      console.warn(`No artifacts found for the given IDs: ${allArtifactIds.join(', ')} from Evaluation ID ${evaluationId}`);
      return [];
    }

    // d) Return the appropriate filepath and mimeType as is done already
    return artifacts.map(artifact => ({
      filepath: artifact.filePath,
      mimeType: artifact.fileMimeType
    }));

  } catch (error) {
    console.error(`Error fetching artifact details for Evaluation ID ${evaluationId}:`, error);
    throw error;
  }
}