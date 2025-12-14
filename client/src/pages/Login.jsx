import { useState } from "react";
import axios from "../api/axios";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const navigate = useNavigate();

  const routeForRole = (role) => {
    if (role === "admin") return "/admin-roles";
    if (role === "researcher") return "/researcher";
    if (role === "reviewer") return "/researcher/reviewer";
    return "/participant";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      // when user logins, the react form sends this to backend:
      const res = await axios.post("/api/auth/login", { email, password });   // should be GET but login is an exception (nodejs tut)

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate(routeForRole(res.data.user?.role));
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
      if (err.response?.data?.requiresVerification) {
        setNeedsVerification(true);
        setVerifyEmail(err.response?.data?.email || email);
        setMessage("Enter the code we sent to verify your email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setVerifying(true);
    try {
      const res = await axios.post("/api/auth/verify-email", {
        email: verifyEmail,
        code: verifyCode.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate(routeForRole(res.data.user?.role));
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!verifyEmail) return;
    setError("");
    setMessage("");
    setVerifying(true);
    try {
      const res = await axios.post("/api/auth/resend-verification", { email: verifyEmail });
      setMessage(res.data?.message || "Verification code sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend code");
    } finally {
      setVerifying(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setMessage("");
    setNeedsVerification(false);
    setGuestLoading(true);
    try {
      const res = await axios.post("/api/auth/guest-login");
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/participant");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start guest session");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-4 grid gap-2">
            <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">
              or
            </div>
            <Button type="button" variant="outline" onClick={handleGuestLogin} disabled={guestLoading} className="w-full">
              {guestLoading ? "Starting guest session..." : "Login as guest"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Guest sessions last 4 hours and only access public studies.
            </p>
          </div>

          {needsVerification ? (
            <div className="mt-6 rounded-md border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold">Verify your email</p>
              <form onSubmit={handleVerify} className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="verifyEmail">Email</Label>
                  <Input
                    id="verifyEmail"
                    type="email"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="verifyCode">Verification code</Label>
                  <Input
                    id="verifyCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={verifying}>
                    {verifying ? "Verifying..." : "Verify and continue"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResend} disabled={verifying || !verifyEmail}>
                    Resend code
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex w-full flex-col items-start gap-2">
          <Link to="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <p className="text-sm text-muted-foreground">
            Don’t have an account?{' '}
            <Link to="/register" className="text-primary underline-offset-4 hover:underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
