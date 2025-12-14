import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "../api/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCcw, ShieldCheck, UploadCloud, UserRound } from "lucide-react";

const StatusBanner = ({ type, message }) => {
  if (!message) return null;
  const tone =
    type === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const Icon = type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <Icon className="size-4" />
      <span>{message}</span>
    </div>
  );
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const resolveAvatarUrl = (value) => {
  if (!value) return "";
  try {
    const base = axios.defaults.baseURL || (typeof window !== "undefined" ? window.location.origin : "");
    return new URL(value, base).href;
  } catch {
    return value;
  }
};

export default function Profile() {
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const storedUserRole = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("user");
      return raw ? JSON.parse(raw)?.role || null : null;
    } catch {
      return null;
    }
  }, []);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [accountForm, setAccountForm] = useState({ name: "", email: "" });
  const [accountStatus, setAccountStatus] = useState({ type: "", message: "" });
  const [savingAccount, setSavingAccount] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarStatus, setAvatarStatus] = useState({ type: "", message: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resumeChip, setResumeChip] = useState(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const parseEstimatedSeconds = (value) => {
    if (!value) return null;
    const match = String(value).match(/(\d+)/);
    if (!match) return null;
    const minutes = Number(match[1]);
    return Number.isFinite(minutes) ? minutes * 60 : null;
  };
  const [deleteStatus, setDeleteStatus] = useState({ type: "", message: "" });
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const initials = useMemo(() => {
    if (profile?.name) {
      return profile.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
    }
    if (profile?.email) return profile.email[0].toUpperCase();
    return "?";
  }, [profile]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    setError("");
    setAccountStatus({ type: "", message: "" });
    setAvatarStatus({ type: "", message: "" });
    try {
      const raw = window.localStorage.getItem("user");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.role === "guest") {
        setError("Profile changes are disabled for guest sessions. Register or sign in to edit your account.");
        setLoadingProfile(false);
        return;
      }
      const allowedRoles = ["researcher", "participant", "admin", "reviewer"];
      if (parsed && !allowedRoles.includes(parsed.role)) {
        navigate("/login");
        return;
      }
    } catch {
      // fall through to network fetch
    }
    try {
      const res = await axios.get("/api/auth/me");
      setProfile(res.data.user);
      setAccountForm({
        name: res.data.user?.name || "",
        email: res.data.user?.email || "",
      });
      const resolvedAvatar = resolveAvatarUrl(res.data.user?.avatarUrl);
      setAvatarUrl(resolvedAvatar);
      if (typeof window !== "undefined" && res.data.user) {
        window.localStorage.setItem("user", JSON.stringify(res.data.user));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const syncActive = () => {
      try {
        const raw = window.localStorage.getItem("competencyActive");
        if (!raw) {
          setResumeChip(null);
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.assignmentId) {
          setResumeChip({
            assignmentId: parsed.assignmentId,
            title: parsed.title || "Competency",
            estimatedTime: parsed.estimatedTime || "",
            startedAt: parsed.startedAt || null,
            durationSeconds: parsed.durationSeconds || null,
          });
        } else {
          setResumeChip(null);
        }
      } catch {
        setResumeChip(null);
      }
    };
    syncActive();
    const storageHandler = () => syncActive();
    window.addEventListener("storage", storageHandler);
    window.addEventListener("competency-active-changed", storageHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("competency-active-changed", storageHandler);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!profile) return;
    setAccountStatus({ type: "", message: "" });
    setSavingAccount(true);
    try {
      const res = await axios.put("/api/auth/update", {
        id: profile.id,
        name: accountForm.name.trim(),
      });
      setProfile((prev) => ({ ...prev, ...res.data.user }));
      if (typeof window !== "undefined" && res.data.user) {
        window.localStorage.setItem("user", JSON.stringify(res.data.user));
      }
      setAccountStatus({ type: "success", message: "Profile updated successfully." });
    } catch (err) {
      setAccountStatus({
        type: "error",
        message: err.response?.data?.message || "Could not update profile.",
      });
    } finally {
      setSavingAccount(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: "", message: "" });

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordStatus({ type: "error", message: "Please fill out all password fields." });
      return;
    }
    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordStatus({
        type: "error",
        message: "New password must be different from your current password.",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      await axios.post("/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordStatus({ type: "success", message: "Password updated successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordStatus({
        type: "error",
        message: err.response?.data?.message || "Could not change password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setAvatarStatus({ type: "", message: "" });
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await axios.post("/api/auth/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = res.data?.user;
      const resolved = resolveAvatarUrl(updated?.avatarUrl);
      setProfile((prev) => ({ ...prev, ...updated }));
      setAvatarUrl(resolved);
      if (typeof window !== "undefined" && updated) {
        window.localStorage.setItem("user", JSON.stringify(updated));
      }
      setAvatarStatus({ type: "success", message: "Profile picture updated." });
    } catch (err) {
      setAvatarStatus({
        type: "error",
        message: err.response?.data?.message || "Could not update avatar.",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarStatus({ type: "", message: "" });
    setUploadingAvatar(true);
    try {
      const res = await axios.delete("/api/auth/avatar");
      const updated = res.data?.user;
      setProfile((prev) => ({ ...prev, ...updated }));
      setAvatarUrl("");
      if (typeof window !== "undefined" && updated) {
        window.localStorage.setItem("user", JSON.stringify(updated));
      }
      setAvatarStatus({ type: "success", message: "Profile picture removed." });
    } catch (err) {
      setAvatarStatus({
        type: "error",
        message: err.response?.data?.message || "Could not remove avatar.",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus({ type: "", message: "" });
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Delete your account? This removes your profile and you will be logged out. This cannot be undone.",
          );
    if (!confirmed) return;
    setDeletingAccount(true);
    try {
      await axios.delete("/api/auth/account");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("user");
      }
      setDeleteStatus({ type: "success", message: "Account deleted. Redirecting to login..." });
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteStatus({
        type: "error",
        message: err.response?.data?.message || "Could not delete account.",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const triggerAvatarSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isBusy = loadingProfile && !profile;
  const profileLoaded = Boolean(profile);
  const effectiveRole = profile?.role || storedUserRole;
  const dashboardPath =
    effectiveRole === "researcher"
      ? "/researcher"
      : effectiveRole === "reviewer"
      ? "/researcher/reviewer"
      : "/participant";

  return (
    <div className="min-h-screen bg-muted/20 py-10">
      {resumeChip ? (() => {
        const durationSeconds =
          resumeChip.durationSeconds || parseEstimatedSeconds(resumeChip.estimatedTime);
        const remainingSeconds =
          durationSeconds && resumeChip.startedAt
            ? Math.max(durationSeconds - Math.floor((nowTs - resumeChip.startedAt) / 1000), 0)
            : null;
        return (
          <div className="fixed bottom-5 left-5 z-40 flex items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-amber-700">Active competency</span>
              <span className="text-sm font-semibold text-amber-900 truncate max-w-[220px]">
                {resumeChip.title}
              </span>
            </div>
            {Number.isFinite(remainingSeconds) ? (
              <Badge variant="outline" className="bg-white text-amber-800 border-amber-300">
                {Math.max(Math.floor(remainingSeconds / 60), 0)}m left
              </Badge>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => navigate("/participant/competency")}
              aria-label="Return to active competency"
            >
              Open
            </Button>
          </div>
        );
      })() : null}
      <div className="mx-auto max-w-5xl space-y-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Account</p>
            <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to={dashboardPath}>
                <ArrowLeft className="mr-2 size-4" />
                Back to dashboard
              </Link>
            </Button>
            <Button variant="outline" onClick={loadProfile} disabled={loadingProfile}>
              {loadingProfile ? <Spinner className="mr-2" /> : <RefreshCcw className="mr-2 size-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {error ? <StatusBanner type="error" message={error} /> : null}

        {isBusy ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Spinner className="size-6" />
              <span className="ml-3 text-sm text-muted-foreground">Loading profile...</span>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={profile?.name || "Avatar"} /> : null}
                    <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">{profile?.name || "Your profile"}</CardTitle>
                    <CardDescription>{profile?.email}</CardDescription>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {profile?.role || "member"}
                      </Badge>
                      <Badge variant={profile?.emailVerified ? "default" : "outline"}>
                        {profile?.emailVerified ? "Email verified" : "Email not verified"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <UserRound className="size-4" />
                  <span>Member since {formatDate(profile?.createdAt)}</span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">User ID</p>
                  <p className="mt-1 font-mono text-sm">{profile?.id}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                  <p className="mt-1 font-medium capitalize">{profile?.role || "member"}</p>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="account" className="w-full">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>
              </div>
              <Separator className="my-4" />

              <TabsContent value="account" className="grid gap-4 lg:grid-cols-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Profile details</CardTitle>
                    <CardDescription>Update your name. Email is read-only.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StatusBanner type={accountStatus.type} message={accountStatus.message} />
                    <form onSubmit={handleAccountSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Profile picture</Label>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            {avatarUrl ? (
                              <AvatarImage src={avatarUrl} alt={profile?.name || "Avatar"} />
                            ) : null}
                            <AvatarFallback className="font-medium">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              id="avatarUpload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="flex items-center gap-2"
                              onClick={triggerAvatarSelect}
                              disabled={!profileLoaded || uploadingAvatar}
                            >
                              {uploadingAvatar ? <Spinner className="size-4" /> : <UploadCloud className="size-4" />}
                              {uploadingAvatar ? "Uploading..." : "Upload"}
                            </Button>
                            {avatarUrl ? (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={handleAvatarRemove}
                                disabled={!profileLoaded || uploadingAvatar}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Stored on the server for your account. Re-upload to change.
                        </p>
                        <StatusBanner type={avatarStatus.type} message={avatarStatus.message} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={accountForm.name}
                          onChange={(e) =>
                            setAccountForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="Your full name"
                          required
                          disabled={!profileLoaded || savingAccount}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={accountForm.email}
                          readOnly
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={!profileLoaded || savingAccount}>
                          {savingAccount ? (
                            <>
                              <Spinner className="mr-2" />
                              Saving...
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setAccountForm({
                              name: profile?.name || "",
                              email: profile?.email || "",
                            })
                          }
                          disabled={!profileLoaded || savingAccount}
                        >
                          Reset
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Profile status</CardTitle>
                    <CardDescription>Key info about your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="size-5 text-emerald-600" />
                        <div>
                          <p className="font-medium">
                            {profile?.emailVerified ? "Verified email" : "Verification pending"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {profile?.emailVerified
                              ? "You are verified and can access secured areas."
                              : "Verify your email to unlock all features."}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                      <p className="mt-1 font-medium capitalize">{profile?.role || "member"}</p>
                      <p className="text-sm text-muted-foreground">
                        Role is assigned by administrators and cannot be changed here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <div className="grid gap-4">
                  <Card className="w-full">
                    <CardHeader>
                      <CardTitle>Change password</CardTitle>
                      <CardDescription>Keep your account secure with a strong password.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <StatusBanner type={passwordStatus.type} message={passwordStatus.message} />
                      <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current password</Label>
                            <Input
                              id="currentPassword"
                              type="password"
                              autoComplete="current-password"
                              value={passwordForm.currentPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                              }
                              required
                              disabled={!profileLoaded || savingPassword}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <Input
                              id="newPassword"
                              type="password"
                              autoComplete="new-password"
                              minLength={6}
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                              }
                              placeholder="At least 6 chars, 1 uppercase"
                              required
                              disabled={!profileLoaded || savingPassword}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <Input
                              id="confirmPassword"
                              type="password"
                              autoComplete="new-password"
                              value={passwordForm.confirmPassword}
                              onChange={(e) =>
                                setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                              }
                              required
                              disabled={!profileLoaded || savingPassword}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={!profileLoaded || savingPassword}>
                            {savingPassword ? (
                              <>
                                <Spinner className="mr-2" />
                                Updating...
                              </>
                            ) : (
                              "Update password"
                            )}
                          </Button>
                          <Button variant="link" asChild>
                            <Link to="/forgot-password" state={{ from: "/profile" }}>
                              Forgot password?
                            </Link>
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Password must be at least 6 characters and include one uppercase letter.
                        </p>
                      </form>
                    </CardContent>
                  </Card>
                  <Card className="w-full border-destructive/40">
                    <CardHeader>
                      <CardTitle className="text-destructive">Delete account</CardTitle>
                      <CardDescription>
                        Permanently remove your account and sign out from this device.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <StatusBanner type={deleteStatus.type} message={deleteStatus.message} />
                      <p className="text-sm text-muted-foreground">
                        This action cannot be undone. Your account and profile data will be removed.
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={!profileLoaded || deletingAccount}
                        onClick={handleDeleteAccount}
                      >
                        {deletingAccount ? (
                          <>
                            <Spinner className="mr-2" />
                            Deleting...
                          </>
                        ) : (
                          "Delete my account"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
