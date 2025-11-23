const transactions = [];

jest.mock('../../models', () => {
  const makeTx = () => ({
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
  });

  const ArtifactAssessment = {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
  };

  const ArtifactAssessmentItem = {
    bulkCreate: jest.fn(),
  };

  const StudyArtifact = {
    findOne: jest.fn(),
  };

  const StudyParticipant = {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  };

  const Artifact = {
    findByPk: jest.fn(),
  };

  const Evaluation = {
    findByPk: jest.fn(),
  };

  return {
    sequelize: {
      transaction: jest.fn(async () => {
        const tx = makeTx();
        transactions.push(tx);
        return tx;
      }),
    },
    ArtifactAssessment,
    ArtifactAssessmentItem,
    StudyArtifact,
    StudyParticipant,
    Study: {},
    Artifact,
    User: {},
    Evaluation,
  };
});

const models = require('../../models');
const {
  createArtifactAssessment,
  getArtifactAssessments,
} = require('../../controllers/artifactAssessmentsController');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockRequest = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { id: 99, role: 'participant' },
  headers: {},
  ...overrides,
});

describe('artifactAssessmentsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactions.length = 0;
    models.ArtifactAssessmentItem.bulkCreate.mockResolvedValue([]);
    models.StudyArtifact.findOne.mockResolvedValue(null);
    models.StudyParticipant.findByPk.mockResolvedValue(null);
    models.StudyParticipant.findOne.mockResolvedValue(null);
    models.ArtifactAssessment.create.mockResolvedValue({ id: 1 });
    models.ArtifactAssessment.findByPk.mockResolvedValue({
      get: () => ({ id: 1, items: [] }),
    });
  });

  test('createArtifactAssessment validates required fields', async () => {
    const req = mockRequest({
      body: { studyId: 1 },
    });
    const res = mockResponse();

    await createArtifactAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('studyId') }),
    );
  });

  test('createArtifactAssessment persists record and items', async () => {
    models.StudyArtifact.findOne.mockResolvedValue({ id: 4, studyId: 2 });
    models.StudyParticipant.findOne.mockResolvedValue({ id: 7 });

    models.ArtifactAssessmentItem.bulkCreate.mockResolvedValue([]);

    const req = mockRequest({
      body: {
        studyId: 2,
        studyArtifactId: 4,
        assessmentType: 'bug_stage',
        items: [
          { dimension: 'bug_stage', key: 'stage', value: 'implementation' },
          { dimension: 'solid_principle', key: 'SRP', value: 'pass' },
        ],
      },
    });
    const res = mockResponse();

    await createArtifactAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(models.ArtifactAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({ studyId: 2, studyArtifactId: 4, assessmentType: 'bug_stage' }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(models.ArtifactAssessmentItem.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'bug_stage', key: 'stage' }),
      ]),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ assessment: expect.objectContaining({ id: 1 }) }),
    );
  });

  test('getArtifactAssessments scopes participant queries to evaluator', async () => {
    models.ArtifactAssessment.findAll.mockResolvedValue([
      { get: () => ({ id: 3, items: [] }) },
    ]);
    const req = mockRequest({ query: { studyId: 5 } });
    const res = mockResponse();

    await getArtifactAssessments(req, res);

    expect(models.ArtifactAssessment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studyId: 5, evaluatorUserId: req.user.id }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ assessments: expect.arrayContaining([expect.objectContaining({ id: 3 })]) }),
    );
  });
});
