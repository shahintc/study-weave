import models from "../../../models/index.js";

const { Evaluation, StudyComparison, StudyArtifact, Artifact } = models;

export async function getContent(evaluationId) {
  if (!evaluationId) {
    return [];
  }

  const evaluation = await Evaluation.findByPk(evaluationId, {
    include: [
      {
        model: StudyComparison,
        as: "comparison",
        include: [
          {
            model: StudyArtifact,
            as: "primaryArtifact",
            include: [{ model: Artifact, as: "artifact", attributes: ["id", "filePath", "fileMimeType", "fileOriginalName"] }],
          },
          {
            model: StudyArtifact,
            as: "secondaryArtifact",
            include: [{ model: Artifact, as: "artifact", attributes: ["id", "filePath", "fileMimeType", "fileOriginalName"] }],
          },
        ],
      },
    ],
  });

  if (!evaluation || !evaluation.comparison) {
    return [];
  }

  const uploads = [];
  const pushArtifact = (artifact) => {
    if (artifact?.filePath && artifact?.fileMimeType) {
      uploads.push({
        filepath: artifact.filePath,
        mimeType: artifact.fileMimeType,
      });
    }
  };

  pushArtifact(evaluation.comparison.primaryArtifact?.artifact);
  pushArtifact(evaluation.comparison.secondaryArtifact?.artifact);

  return uploads;
}
