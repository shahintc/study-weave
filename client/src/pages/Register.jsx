import { useState } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

const PASSWORD_POLICY = /^(?=.*[A-Z]).{6,}$/;

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "participant" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("register");
  const [pendingEmail, setPendingEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatusMessage("");

    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (!PASSWORD_POLICY.test(form.password)) {
      return setError("Password must be at least 6 characters and include one uppercase letter.");
    }

    setLoading(true);

    try {
      const response = await axios.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });

      setPendingEmail(form.email);
      setStep("verify");
      setStatusMessage(response.data?.message || "Verification code sent. Check your email.");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pendingEmail) return setError("Enter your email first.");
    if (!verifyCode.trim()) return setError("Enter the verification code from your email.");
    setLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const res = await axios.post("/api/auth/verify-email", {
        email: pendingEmail,
        code: verifyCode.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      const role = res.data.user?.role;
      if (role === "researcher") {
        navigate("/researcher");
      } else {
        navigate("/participant");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    setError("");
    setStatusMessage("");
    try {
      const res = await axios.post("/api/auth/resend-verification", { email: pendingEmail });
      setStatusMessage(res.data?.message || "Verification code resent. Check your inbox.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            {step === "verify" ? "Verify your email" : "Create account"}
          </CardTitle>
          <CardDescription>
            {step === "verify"
              ? `Enter the 6-digit code sent to ${pendingEmail || "your email"}.`
              : "Register to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {statusMessage ? (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {statusMessage}
            </div>
          ) : null}

          {step === "verify" ? (
            <form onSubmit={handleVerify} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="verifyEmail">Email</Label>
                <Input
                  id="verifyEmail"
                  type="email"
                  value={pendingEmail}
                  onChange={(e) => setPendingEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Verifying..." : "Verify and continue"}
                </Button>
                <Button type="button" variant="outline" onClick={handleResend} disabled={loading || !pendingEmail}>
                  Resend code
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-fit px-0 text-sm"
                onClick={() => {
                  setStep("register");
                  setStatusMessage("");
                  setError("");
                }}
              >
                Back to registration
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  required
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 6 chars, 1 uppercase"
                  required
                  value={form.password}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={form.confirm}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(val) => setForm({ ...form, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating account..." : "Register"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
