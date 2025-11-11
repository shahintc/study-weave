const mockStudyAnalytics = {
  "study-ai-readability": {
    id: "study-ai-readability",
    title: "AI vs. Human Code Readability",
    studyCode: "ST-42A",
    principalInvestigator: "Dr. Priya Malhotra",
    startDate: "2025-02-01T00:00:00.000Z",
    endDate: "2025-03-15T00:00:00.000Z",
    artifacts: [
      { id: "artifact-ai-a", name: "AI Snippet - Sorting" },
      { id: "artifact-ai-b", name: "Human Snippet - Parsing" },
      { id: "artifact-ai-c", name: "Mixed Review Pair" },
    ],
    participants: [
      {
        id: "p-101",
        name: "Nia Patel",
        region: "North America",
        joinedAt: "2025-02-01T13:10:00.000Z",
        progress: 96,
        persona: "Senior Engineer",
        completedAt: "2025-02-18T16:25:00.000Z",
        ratings: [
          {
            artifactId: "artifact-ai-a",
            artifactName: "AI Snippet - Sorting",
            rating: 4.6,
            submittedAt: "2025-02-03T12:30:00.000Z",
          },
          {
            artifactId: "artifact-ai-b",
            artifactName: "Human Snippet - Parsing",
            rating: 3.9,
            submittedAt: "2025-02-07T11:15:00.000Z",
          },
          {
            artifactId: "artifact-ai-c",
            artifactName: "Mixed Review Pair",
            rating: 4.8,
            submittedAt: "2025-02-12T15:45:00.000Z",
          },
        ],
      },
      {
        id: "p-104",
        name: "Marco Alvarez",
        region: "Latin America",
        joinedAt: "2025-02-04T09:05:00.000Z",
        progress: 81,
        persona: "Full-stack Engineer",
        completedAt: "2025-02-24T18:10:00.000Z",
        ratings: [
          {
            artifactId: "artifact-ai-a",
            artifactName: "AI Snippet - Sorting",
            rating: 3.8,
            submittedAt: "2025-02-05T10:10:00.000Z",
          },
          {
            artifactId: "artifact-ai-b",
            artifactName: "Human Snippet - Parsing",
            rating: 4.1,
            submittedAt: "2025-02-11T14:05:00.000Z",
          },
        ],
      },
      {
        id: "p-112",
        name: "Harper Watanabe",
        region: "APAC",
        joinedAt: "2025-02-06T15:20:00.000Z",
        progress: 57,
        persona: "Design Technologist",
        completedAt: null,
        ratings: [
          {
            artifactId: "artifact-ai-b",
            artifactName: "Human Snippet - Parsing",
            rating: 4.4,
            submittedAt: "2025-02-08T08:40:00.000Z",
          },
          {
            artifactId: "artifact-ai-c",
            artifactName: "Mixed Review Pair",
            rating: 4.7,
            submittedAt: "2025-02-21T09:50:00.000Z",
          },
        ],
      },
      {
        id: "p-129",
        name: "Sonia Mbatha",
        region: "EMEA",
        joinedAt: "2025-02-10T11:00:00.000Z",
        progress: 32,
        persona: "QA Analyst",
        completedAt: null,
        ratings: [
          {
            artifactId: "artifact-ai-a",
            artifactName: "AI Snippet - Sorting",
            rating: 3.6,
            submittedAt: "2025-02-16T10:00:00.000Z",
          },
        ],
      },
    ],
  },
  "study-uml-clarity": {
    id: "study-uml-clarity",
    title: "UML Diagram Clarity",
    studyCode: "ST-55B",
    principalInvestigator: "Prof. Alejandro Ruiz",
    startDate: "2025-01-20T00:00:00.000Z",
    endDate: "2025-04-01T00:00:00.000Z",
    artifacts: [
      { id: "artifact-uml-a", name: "Sequence Diagram" },
      { id: "artifact-uml-b", name: "Component Diagram" },
      { id: "artifact-uml-c", name: "State Diagram" },
    ],
    participants: [
      {
        id: "p-301",
        name: "Avery Brooks",
        region: "North America",
        joinedAt: "2025-01-22T08:20:00.000Z",
        progress: 64,
        persona: "Product Manager",
        completedAt: null,
        ratings: [
          {
            artifactId: "artifact-uml-a",
            artifactName: "Sequence Diagram",
            rating: 4.1,
            submittedAt: "2025-01-27T09:10:00.000Z",
          },
          {
            artifactId: "artifact-uml-b",
            artifactName: "Component Diagram",
            rating: 3.5,
            submittedAt: "2025-02-05T11:30:00.000Z",
          },
        ],
      },
      {
        id: "p-318",
        name: "Liam Fischer",
        region: "EMEA",
        joinedAt: "2025-02-02T10:00:00.000Z",
        progress: 48,
        persona: "Business Analyst",
        completedAt: null,
        ratings: [
          {
            artifactId: "artifact-uml-b",
            artifactName: "Component Diagram",
            rating: 3.9,
            submittedAt: "2025-02-09T10:45:00.000Z",
          },
          {
            artifactId: "artifact-uml-c",
            artifactName: "State Diagram",
            rating: 4.0,
            submittedAt: "2025-02-19T12:35:00.000Z",
          },
        ],
      },
      {
        id: "p-333",
        name: "Fatima Noor",
        region: "APAC",
        joinedAt: "2025-02-10T12:15:00.000Z",
        progress: 22,
        persona: "UX Researcher",
        completedAt: null,
        ratings: [
          {
            artifactId: "artifact-uml-a",
            artifactName: "Sequence Diagram",
            rating: 3.7,
            submittedAt: "2025-02-14T07:50:00.000Z",
          },
        ],
      },
    ],
  },
};

module.exports = { mockStudyAnalytics };
