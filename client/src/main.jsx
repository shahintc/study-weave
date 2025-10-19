import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import "./assets/App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* App.jsx is the layout for all the below routes */}
      <Route path="/" element={<App />}>
        {/* Auth Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* later adding other app routes here (e.g., Dashboards, Study pages)
          Example: <Route path="/dashboard" element={<ResearcherDashboard />} /> 
          thsi index route will be the default page shown at "/"
          Example: <Route index element={<HomePage />} />
        */}
      </Route>
    </Routes>
  </BrowserRouter>
);