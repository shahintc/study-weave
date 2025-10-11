import { useState } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "participant" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return alert("Passwords do not match!");
    setLoading(true);
    try {
      await axios.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      alert("Registration successful!");
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Register</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input name="name" placeholder="Full name" required onChange={handleChange} />
        <input name="email" type="email" placeholder="Email" required onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" required onChange={handleChange} />
        <input name="confirm" type="password" placeholder="Confirm Password" required onChange={handleChange} />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="participant">Participant</option>
          <option value="researcher">Researcher</option>
        </select>
        <button type="submit" disabled={loading}>{loading ? "..." : "Register"}</button>
      </form>
      <p>Already registered? <Link to="/login">Login</Link></p>
    </div>
  );
}
