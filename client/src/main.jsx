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
import ParticipantsListPage from "./pages/ParticipantsListPage";


ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* App.jsx is the layout for all the below routes */}
      <Route path="/" element={<App />}>
        {/* Auth Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        {/* Back-compat single-route dashboards */}
        <Route path="/participant-dashboard" element={<Navigate to="/participant" replace />} />
        <Route path="/researcher-dashboard" element={<Navigate to="/researcher" replace />} />

        {/* Researcher area (nested) */}
        <Route path="/researcher" element={<ResearcherLayout />}>
          <Route index element={<ResearcherDashboard />} />
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="assess" element={<AssessmentCreation />} />
          <Route path="assessment-creation" element={<AssessmentCreation />} />
          <Route path="study-creation-wizard" element={<StudyCreationWizard />} /> 
          <Route path="participants-list" element={<ParticipantsListPage />} />
          {/* Alias for older links */}
          <Route path="studies" element={<StudyCreationWizard />} />
        </Route>

        {/* Participant area (nested) */}
        <Route path="/participant" element={<ParticipantLayout />}>
          <Route index element={<ParticipantDashboard />} />
          <Route path="artifacts-comparison" element={<ArtifactsComparison />} />
          <Route path="competency" element={<ParticipantCompetencyAssessment />} />
        </Route>

        {/* Aliases for older root-level links */}
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/study-creation-wizard" element={<StudyCreationWizard />} />  
        <Route path="/artifacts-comparison" element={<ArtifactsComparison />} />
        <Route path="/assessment-creation" element={<AssessmentCreation />} />
        <Route path="/participant-competency" element={<ParticipantCompetencyAssessment />} />


        {/* later adding other app routes here (e.g., Dashboards, Study pages)
          Example: <Route path="/dashboard" element={<ResearcherDashboard />} />
          thsi index route will be the default page shown at "/"
          Example: <Route index element={<HomePage />} />
        */}
      </Route>
    </Routes>
  </BrowserRouter>
);
