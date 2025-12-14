import Artifact from "../../../sequelize-models/artifact.js";
import StudyComparison from "../../../sequelize-models/studyComparison.js";
import StudyArtifact from "../../../sequelize-models/studyArtifact.js";

export async function getContent(comparisonId) {
  try {
    const comparison = await StudyComparison.findByPk(comparisonId, {
      include: [
        {
          model: StudyArtifact,
          as: 'primaryArtifact', // Changed from primaryStudyArtifact
          include: [{ model: Artifact, as: 'artifact' }] // Alias from studyArtifact.js
        },
        {
          model: StudyArtifact,
          as: 'secondaryArtifact', // Changed from secondaryStudyArtifact
          include: [{ model: Artifact, as: 'artifact' }]
        }
      ]
    });

    if (!comparison) {
      throw new Error('StudyComparison not found');
    }

    // Access nested artifact data from models
    const primary = comparison.primaryArtifact.artifact; // Changed from primaryStudyArtifact
    const secondary = comparison.secondaryArtifact.artifact; // Changed from secondaryStudyArtifact

    // Return as an array of objects with requested capitalization
    return [
      {
        filepath: primary.filePath,
        mimeType: primary.fileMimeType
      },
      {
        filepath: secondary.filePath,
        mimeType: secondary.fileMimeType
      }
    ];
  } catch (error) {
    console.error('Error fetching artifact details:', error);
    throw error;
  }
}
