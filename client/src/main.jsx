import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ParticipantDashboard from "./pages/participant-dashboard";
import ResearcherDashboard from "./pages/researcher-dashboard";
import ArtifactsPage from "./pages/artifactManagement/ArtifactsPage";
import StudyCreationWizard from "./pages/StudyCreationWizard";
import "./assets/App.css";
import ArtifactsComparison from "./pages/ArtifactsComparison";
import AssessmentCreation from "./pages/AssessmentCreationPage";
import ParticipantCompetencyAssessment from "./pages/participant_competency_assessment";
import ResearcherLayout from "./pages/ResearcherLayout";
import ParticipantLayout from "./pages/ParticipantLayout";
import ParticipantStudies from "./pages/ParticipantStudies";
import ProtectedRoute from "./components/ProtectedRoute";
import ParticipantsListPage from "./pages/ParticipantsListPage";
import AdminRoleManagementPage from "./pages/AdminRoleManagementPage";
import CompetencyEvaluationReview from "./pages/CompetencyEvaluationReview";
import ReviewerAdjudication from "./pages/ReviewerAdjudication";
import StudiesPage from "./pages/StudiesPage";

const resolveDefaultRoute = () => {
  if (typeof window === "undefined") return "/researcher";
  try {
    const raw = window.localStorage.getItem("user");
    const role = raw ? JSON.parse(raw)?.role : null;
    if (role === "admin") return "/admin-roles";
    if (role === "participant") return "/participant";
    if (role === "reviewer") return "/researcher/reviewer";
  } catch {
    // ignore parse errors
  }
  return "/researcher";
};

const RoleAwareHomeRedirect = () => <Navigate to={resolveDefaultRoute()} replace />;

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* Public Auth Pages - these routes are accessible without a token */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Protected Routes - All routes within this group require authentication */}
      {/* The App component acts as the main layout for all protected content */}
      <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
        {/* Default route for authenticated users landing on "/" */}
        <Route index element={<RoleAwareHomeRedirect />} />

        {/* Other protected routes */}
        <Route path="/profile" element={<Profile />} />

        {/* Back-compat single-route dashboards */}
        <Route path="/participant-dashboard" element={<Navigate to="/participant" replace />} />
        <Route path="/researcher-dashboard" element={<Navigate to="/researcher" replace />} />

        {/* Researcher area (nested) */}
        <Route path="/researcher" element={<ResearcherLayout />}>
          <Route index element={<ResearcherDashboard />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="assess" element={<AssessmentCreation />} />
          <Route path="assessment-creation" element={<AssessmentCreation />} />
          <Route path="competency-review" element={<CompetencyEvaluationReview />} />
          <Route path="reviewer" element={<ReviewerAdjudication />} />
          <Route path="study-creation-wizard" element={<StudyCreationWizard />} /> 
          <Route path="participants-list" element={<ParticipantsListPage />} />
          <Route path="studies" element={<StudiesPage archived={false} />} />
          <Route path="archived-studies" element={<StudiesPage archived />} />
          <Route path="studies/new" element={<StudyCreationWizard />} />
        </Route>

        {/* Participant area (nested) */}
        <Route path="/participant" element={<ParticipantLayout />}>
          <Route index element={<ParticipantDashboard />} />
          <Route path="artifacts-comparison" element={<ArtifactsComparison />} />
          <Route path="competency" element={<ParticipantCompetencyAssessment />} />
          <Route path="studies" element={<ParticipantStudies />} />
        </Route>

        {/* Aliases for older root-level links */}
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/study-creation-wizard" element={<StudyCreationWizard />} />  
        <Route path="/artifacts-comparison" element={<ArtifactsComparison />} />
        <Route path="/assessment-creation" element={<AssessmentCreation />} />
        <Route path="/participant-competency" element={<ParticipantCompetencyAssessment />} />

         <Route path="/admin-roles" element={<AdminRoleManagementPage />} />


        {/* later adding other app routes here (e.g., Dashboards, Study pages)
          Example: <Route path="/dashboard" element={<ResearcherDashboard />} />
          thsi index route will be the default page shown at "/"
          Example: <Route index element={<HomePage />} />
        */}
      </Route>
    </Routes>
  </BrowserRouter>
);
