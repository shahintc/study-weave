import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../api/axios";

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return alert("Passwords do not match!");
    try {
      await axios.post("/api/auth/reset", { token, password });
      alert("Password reset successful!");
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset password");
    }
  };

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="password" placeholder="New Password" required
               onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm Password" required
               onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit">Reset</button>
      </form>
    </div>
  );
}
