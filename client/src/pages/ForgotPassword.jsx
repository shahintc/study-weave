import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import axios from "../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // This is a placeholder for "forgot password" API call
      // await axios.post("/api/auth/forgot-password", { email });
      alert("If an account exists for this email, a reset link has been sent.");
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Forgot Password</h2>
      <p>Enter your email to receive a password reset link.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="email" placeholder="Email" required value={email}
               onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "..." : "Send Link"}</button>
      </form>
      <p><Link to="/login">Back to login</Link></p>
    </div>
  );
}