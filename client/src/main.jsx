import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ParticipantDashboard from "./pages/participant-dashboard";
import ResearcherDashboard from "./pages/researcher-dashboard";
import ArtifactsPage from "./pages/ArtifactsPage";
import Test from "./pages/test";
import "./assets/App.css";

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
        <Route path="/participant-dashboard" element={<ParticipantDashboard />} />
        <Route path="/researcher-dashboard" element={<ResearcherDashboard />} />
        <Route path="/artifacts" element={<ArtifactsPage />} />
        <Route path="/test" element={<Test />} />

        {/* later adding other app routes here (e.g., Dashboards, Study pages)
          Example: <Route path="/dashboard" element={<ResearcherDashboard />} />
          thsi index route will be the default page shown at "/"
          Example: <Route index element={<HomePage />} />
        */}
      </Route>
    </Routes>
  </BrowserRouter>
);
