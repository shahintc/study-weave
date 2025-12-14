import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Search,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";

const ROLE_FILTERS = [
  { label: "All roles", value: "all" },
  { label: "Researchers", value: "researcher" },
  { label: "Participants", value: "participant" },
  { label: "Reviewers", value: "reviewer" },
  { label: "Admins", value: "admin" },
  { label: "Guests", value: "guest" },
];

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const Banner = ({ tone = "info", message }) => {
  if (!message) return null;
  const toneMap = {
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-border bg-muted/40 text-foreground",
  };
  const toneStyles = toneMap[tone] || toneMap.info;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${toneStyles}`}>
      {message}
    </div>
  );
};

function AdminRoleManagementPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
    from: 0,
    to: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyUserId, setBusyUserId] = useState(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("user");
      if (!raw) {
        navigate("/login");
        setUserLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      setCurrentUser(parsed);
      setUserLoaded(true);
    } catch {
      setUserLoaded(true);
      setError("Unable to read the current user session.");
    }
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const isAdmin = currentUser?.role === "admin";

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const response = await axios.get("/api/auth/users", {
        params: {
          page,
          pageSize,
          search: debouncedSearch || undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
        },
      });
      const fetchedUsers = response.data?.users || [];
      const serverPagination = response.data?.pagination;
      setUsers(fetchedUsers);
      setPagination({
        total: serverPagination?.total ?? fetchedUsers.length,
        page: serverPagination?.page ?? page,
        pageSize: serverPagination?.pageSize ?? pageSize,
        totalPages: serverPagination?.totalPages ?? 0,
        hasNext: Boolean(serverPagination?.hasNext),
        hasPrevious: Boolean(serverPagination?.hasPrevious),
        from: serverPagination?.from ?? (fetchedUsers.length ? (page - 1) * pageSize + 1 : 0),
        to: serverPagination?.to ?? (fetchedUsers.length ? (page - 1) * pageSize + fetchedUsers.length : 0),
      });
      if (!fetchedUsers.length) {
        setInfo("No users matched this filter.");
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Admin privileges are required to access the directory.");
      } else {
        setError(err.response?.data?.message || "Failed to load users.");
      }
      setUsers([]);
      setPagination((prev) => ({
        ...prev,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
        from: 0,
        to: 0,
      }));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, pageSize, debouncedSearch, roleFilter]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  const handleChangeRole = async (userId) => {
    setBusyUserId(userId);
    setError("");
    try {
      const response = await axios.put(`/api/auth/update-role/${userId}`);
      const updatedUser = response.data?.user;
      await loadUsers();
      if (updatedUser) {
        setInfo(`${updatedUser.name || "User"} is now ${updatedUser.role}.`);
      } else {
        setInfo("Role updated.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handleRoleFilterChange = (value) => {
    setRoleFilter(value);
    setPage(1);
  };

  const handlePageSizeChange = (value) => {
    const nextSize = Number(value);
    setPageSize(Number.isFinite(nextSize) && nextSize > 0 ? nextSize : 10);
    setPage(1);
  };

  const goToPreviousPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPage((prev) => prev + 1);
  };

  const paginationSummary = useMemo(() => {
    if (!pagination.total) {
      return "No users recorded.";
    }
    if (!users.length) {
      return "No users on this page.";
    }
    return `Showing ${pagination.from} to ${pagination.to} of ${pagination.total} users.`;
  }, [pagination, users.length]);

  if (!userLoaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center py-10">
        <Spinner className="mr-2" />
        <span className="text-sm text-muted-foreground">Loading admin tools...</span>
      </div>
    );
  }

  if (userLoaded && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Restricted area</CardTitle>
            <CardDescription>Only administrators can view the user directory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Data inside this workspace is read-only for non-admins. Contact an administrator if you need access.
            </p>
            <Button variant="outline" onClick={() => navigate("/profile")}>
              Go to profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Admin workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight">User directory</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and audit registered accounts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Badge variant="secondary" className="capitalize">
            {currentUser?.name || "Admin"}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs uppercase tracking-wide">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-primary/10 p-3">
              <UsersIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total accounts</p>
              <p className="text-2xl font-semibold">{pagination.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admin roles</p>
                <p className="text-lg font-semibold">Role transitions</p>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Read-only for non-admins.</li>
              <li>Toggle researcher and participant roles with one click.</li>
              <li>Audit each account before granting elevated access.</li>
            </ul>
            <div>
              <Button size="sm" onClick={() => document.getElementById("directory")?.scrollIntoView({ behavior: "smooth" })}>
                Jump to directory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by name, email, or role.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[2fr,1fr,1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Role filter" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Rows per page" />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card id="directory">
        <CardHeader className="space-y-1">
          <CardTitle>User directory</CardTitle>
          <CardDescription>Review registered accounts. Roles can be toggled when required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Banner tone="error" message={error} />
          <Banner tone="success" message={info} />
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading users...
            </div>
          ) : users.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{user.name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email || "No email"}</p>
                          <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.role || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(user.createdAt || user.created_at)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleChangeRole(user.id)}
                          disabled={busyUserId === user.id || loading}
                        >
                          {busyUserId === user.id ? <Spinner className="mr-2 h-4 w-4" /> : null}
                          Change Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{paginationSummary}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={loading || !pagination.hasPrevious}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Badge variant="outline">
                    Page {pagination.page} of {Math.max(pagination.totalPages || 1, 1)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={loading || !pagination.hasNext}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {info || "No users available."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminRoleManagementPage;
