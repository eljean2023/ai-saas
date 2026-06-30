"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Trash2, Ban, UserCheck, UserPlus } from "lucide-react";
import { DataTable, Column } from "@/app/components/admin/DataTable";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Modal } from "@/app/components/ui/Modal";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatDate, cn } from "@/lib/utils";

type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
type UserStatus = "ACTIVE" | "BANNED";

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

interface UsersResponse {
  data: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AddUserForm {
  email: string;
  password: string;
  role: UserRole;
}

type ConfirmAction =
  | { type: "ban"; user: UserRow }
  | { type: "unban"; user: UserRow }
  | { type: "delete"; user: UserRow }
  | { type: "promote"; user: UserRow };

const statusBadge: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  BANNED: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const roleBadge: Record<UserRole, string> = {
  USER: "bg-gray-100 text-gray-600",
  ADMIN: "bg-teal-50 text-teal-700",
  SUPER_ADMIN: "bg-emerald-50 text-emerald-700",
};

const emptyAddForm: AddUserForm = { email: "", password: "", role: "USER" };

export default function UsersPage() {
  const authFetch = useAuthFetch();
  const { user: currentUser, isAdmin, isSuperAdmin } = useAuth();
  const isReadOnly = !isAdmin;

  const [users, setUsers] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddUserForm>(emptyAddForm);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (roleFilter) params.set("role", roleFilter);

      const data = await authFetch<UsersResponse>(`/api/admin/users?${params}`);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, statusFilter, roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleConfirmAction = async () => {
    if (!confirm) return;
    setActionLoading(true);
    setActionError(null);

    try {
      if (confirm.type === "ban") {
        await authFetch(`/api/admin/users/${confirm.user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "BANNED" }),
        });
      } else if (confirm.type === "unban") {
        await authFetch(`/api/admin/users/${confirm.user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "ACTIVE" }),
        });
      } else if (confirm.type === "delete") {
        await authFetch(`/api/admin/users/${confirm.user.id}`, {
          method: "DELETE",
        });
      } else if (confirm.type === "promote") {
        await authFetch(`/api/admin/users/${confirm.user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ role: "ADMIN" }),
        });
      }

      setConfirm(null);
      void fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!addForm.email.trim()) {
      setAddFormError("Email is required");
      return;
    }
    if (!addForm.password.trim()) {
      setAddFormError("Password is required");
      return;
    }

    setAddSubmitting(true);
    setAddFormError(null);

    try {
      await authFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(addForm),
      });
      setAddUserOpen(false);
      setAddForm(emptyAddForm);
      void fetchUsers();
    } catch (err) {
      setAddFormError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddSubmitting(false);
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "email",
      header: "Email",
      render: (u) => <span className="font-medium text-gray-900">{u.email}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            roleBadge[u.role]
          )}
        >
          {u.role.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            statusBadge[u.status]
          )}
        >
          {u.status}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (u) => (
        <span className="text-xs text-gray-500">{formatDate(u.createdAt)}</span>
      ),
    },
    ...(isReadOnly
      ? []
      : ([
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (u: UserRow) =>
              !isSuperAdmin && u.role === "SUPER_ADMIN" ? null : (
              <div className="flex items-center justify-end gap-1.5">
                {u.id !== currentUser?.id && (
                  <>
                    {u.status === "ACTIVE" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ type: "ban", user: u })}
                        title="Ban user"
                      >
                        <Ban className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ type: "unban", user: u })}
                        title="Unban user"
                      >
                        <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                    )}
                    {u.role === "USER" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ type: "promote", user: u })}
                        title="Promote to admin"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-teal-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirm({ type: "delete", user: u })}
                      title="Delete user"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ] as Column<UserRow>[])),
  ];

  const confirmLabels: Record<ConfirmAction["type"], string> = {
    ban: "Ban",
    unban: "Unban",
    delete: "Delete",
    promote: "Promote to Admin",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          {isReadOnly && (
            <p className="mt-0.5 text-xs text-amber-600">
              Read-only — your role does not permit user modifications
            </p>
          )}
        </div>

        {isSuperAdmin && (
          <Button onClick={() => setAddUserOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Input
            placeholder="Search by email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as UserStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
        <select
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as UserRole | "");
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users?.data ?? []}
        loading={loading}
        error={error}
        keyExtractor={(u) => u.id}
        emptyMessage="No users match the current filters."
        page={page}
        totalPages={users?.totalPages}
        onPageChange={setPage}
      />

      {/* Confirm action modal — ADMIN and SUPER_ADMIN only */}
      <Modal
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setActionError(null);
        }}
        title={confirm ? `${confirmLabels[confirm.type]} User` : "Confirm Action"}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setConfirm(null);
                setActionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirm?.type === "delete" || confirm?.type === "ban"
                  ? "danger"
                  : "primary"
              }
              loading={actionLoading}
              onClick={() => void handleConfirmAction()}
            >
              {confirm ? confirmLabels[confirm.type] : "Confirm"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to{" "}
          <strong>{confirm?.type.replace("_", " ") ?? ""}</strong> user{" "}
          <strong>{confirm?.user.email}</strong>?
        </p>
        {actionError && (
          <p className="mt-2 text-sm text-red-600">{actionError}</p>
        )}
      </Modal>

      {/* Add New User modal — SUPER_ADMIN only */}
      {isSuperAdmin && (
        <Modal
          open={addUserOpen}
          onClose={() => {
            setAddUserOpen(false);
            setAddForm(emptyAddForm);
            setAddFormError(null);
          }}
          title="Add New User"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAddUserOpen(false);
                  setAddForm(emptyAddForm);
                  setAddFormError(null);
                }}
              >
                Cancel
              </Button>
              <Button loading={addSubmitting} onClick={() => void handleAddUser()}>
                <UserPlus className="h-4 w-4" />
                Create Account
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-700">
              Super Admin exclusive — creates a new account directly without email
              verification.
            </div>

            <Input
              label="Email"
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="new@example.com"
            />

            <Input
              label="Password"
              type="password"
              value={addForm.password}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="Min 8 chars, 1 uppercase, 1 number"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={addForm.role}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    role: e.target.value as UserRole,
                  }))
                }
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {addFormError && (
              <p className="text-sm text-red-600">{addFormError}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
