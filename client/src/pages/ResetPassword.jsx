import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../api/axios";

const PASSWORD_POLICY = /^(?=.*[A-Z]).{6,}$/;

export default function ResetPassword() {
  const { token } = useParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(token || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!PASSWORD_POLICY.test(password)) {
      return setError("Password must be at least 6 characters and include one uppercase letter.");
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/reset-password", { email, code: code.trim(), password });
      setMessage(res.data?.message || "Password reset successful.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Reset Password</h2>
      {error ? <div className="auth-error">{error}</div> : null}
      {message ? <div className="auth-success">{message}</div> : null}
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="6-digit code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password (6+ chars, 1 uppercase)"
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirm Password"
          required
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button type="submit" disabled={loading}>{loading ? "..." : "Reset"}</button>
      </form>
    </div>
  );
}
