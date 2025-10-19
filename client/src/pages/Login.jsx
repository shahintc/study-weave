import { useState } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post("/api/auth/login", { email, password });

      localStorage.setItem("token", res.data.token);
      //
      localStorage.setItem("user", JSON.stringify(res.data.user));

      alert(`Welcome back, ${res.data.user.name}!`);
      navigate("/profile");
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input type="email" placeholder="Email" required value={email}
               onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required value={password}
               onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "..." : "Login"}</button>
      </form>
      <p><Link to="/forgot-password">Forgot password?</Link></p>
      <p>Don’t have an account? <Link to="/register">Register</Link></p>
    </div>
  );
}
