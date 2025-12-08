import Artifact from "../../../sequelize-models/artifact";
import StudyComparison from "../../../sequelize-models/studyComparison";
import StudyArtifact from "../../../sequelize-models/studyArtifact";

export async function getContent(comparisonId) {
  try {
    const comparison = await StudyComparison.findByPk(comparisonId, {
      include: [
        {
          model: StudyArtifact,
          as: 'primaryStudyArtifact', // Alias from studyComparison.js
          include: [{ model: Artifact, as: 'artifact' }] // Alias from studyArtifact.js
        },
        {
          model: StudyArtifact,
          as: 'secondaryStudyArtifact', // Alias from studyComparison.js
          include: [{ model: Artifact, as: 'artifact' }]
        }
      ]
    });

    if (!comparison) {
      throw new Error('StudyComparison not found');
    }

    // Access nested artifact data from models
    const primary = comparison.primaryStudyArtifact.artifact;
    const secondary = comparison.secondaryStudyArtifact.artifact;

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
