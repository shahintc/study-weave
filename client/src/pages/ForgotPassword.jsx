import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../api/axios";

const PASSWORD_POLICY = /^(?=.*[A-Z]).{6,}$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await axios.post("/api/auth/request-password-reset", { email });
      setStep("reset");
      setMessage(res.data?.message || "If an account exists, a reset code was sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirm) {
      return setError("Passwords do not match.");
    }
    if (!PASSWORD_POLICY.test(password)) {
      return setError("Password must be at least 6 characters and include one uppercase letter.");
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/reset-password", {
        email,
        code: code.trim(),
        password,
      });
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
      <h2>{step === "reset" ? "Enter reset code" : "Forgot Password"}</h2>
      <p>
        {step === "reset"
          ? "Check your email for the 6-digit code, then choose a new password."
          : "Enter your email to receive a password reset code."}
      </p>
      {error ? <div className="auth-error">{error}</div> : null}
      {message ? <div className="auth-success">{message}</div> : null}

      {step === "reset" ? (
        <form onSubmit={handleReset} className="auth-form">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "..." : "Reset password"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "..." : "Send code"}
          </button>
        </form>
      )}
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
