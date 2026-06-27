"use client";

import { useEffect, useState, useCallback } from "react";
import { PlusCircle, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { DataTable, Column } from "@/app/components/admin/DataTable";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Modal } from "@/app/components/ui/Modal";
import { useAuthFetch } from "@/app/hooks/useAuthFetch";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatDate, cn, slugify } from "@/lib/utils";

type PostStatus = "DRAFT" | "PUBLISHED";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  author: { id: string; email: string; role: string };
  createdAt: string;
  updatedAt: string;
}

interface PostsResponse {
  data: PostRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PostForm {
  title: string;
  content: string;
  status: PostStatus;
}

const statusBadge: Record<PostStatus, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  DRAFT: "bg-gray-100 text-gray-500",
};

const emptyForm: PostForm = { title: "", content: "", status: "DRAFT" };

export default function ContentPage() {
  const authFetch = useAuthFetch();
  const { isAdmin } = useAuth();
  const isReadOnly = !isAdmin;

  const [posts, setPosts] = useState<PostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PostStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PostRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await authFetch<PostsResponse>(`/api/admin/posts?${params}`);
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, statusFilter]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const openCreate = () => {
    setEditingPost(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (post: PostRow) => {
    setEditingPost(post);
    setForm({ title: post.title, content: "", status: post.status });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingPost) {
        await authFetch(`/api/admin/posts/${editingPost.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title,
            status: form.status,
            content: form.content || undefined,
          }),
        });
      } else {
        if (!form.content.trim()) {
          setFormError("Content is required");
          setSubmitting(false);
          return;
        }
        await authFetch(`/api/admin/posts`, {
          method: "POST",
          body: JSON.stringify({
            title: form.title,
            content: form.content,
            status: form.status,
            slug: slugify(form.title),
          }),
        });
      }

      setModalOpen(false);
      void fetchPosts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (post: PostRow) => {
    const newStatus: PostStatus =
      post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await authFetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      void fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authFetch(`/api/admin/posts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      void fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<PostRow>[] = [
    {
      key: "title",
      header: "Title",
      render: (p) => (
        <div>
          <p className="font-medium text-gray-900">{p.title}</p>
          <p className="text-xs text-gray-400">/{p.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            statusBadge[p.status]
          )}
        >
          {p.status}
        </span>
      ),
    },
    {
      key: "author",
      header: "Author",
      render: (p) => (
        <span className="text-xs text-gray-500">{p.author.email}</span>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (p) => (
        <span className="text-xs text-gray-500">{formatDate(p.updatedAt)}</span>
      ),
    },
    ...(isReadOnly
      ? []
      : ([
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (p: PostRow) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void toggleStatus(p)}
                  title={
                    p.status === "PUBLISHED" ? "Unpublish" : "Publish"
                  }
                >
                  {p.status === "PUBLISHED" ? (
                    <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(p)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5 text-teal-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(p)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            ),
          },
        ] as Column<PostRow>[])),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Content Management
          </h1>
          {isReadOnly && (
            <p className="mt-0.5 text-xs text-amber-600">
              Read-only — your role does not permit content modifications
            </p>
          )}
        </div>
        {!isReadOnly && (
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4" />
            New Post
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <select
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PostStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={posts?.data ?? []}
        loading={loading}
        error={error}
        keyExtractor={(p) => p.id}
        emptyMessage="No posts found."
        page={page}
        totalPages={posts?.totalPages}
        onPageChange={setPage}
      />

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPost ? "Edit Post" : "Create Post"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={submitting} onClick={() => void handleSubmit()}>
              {editingPost ? "Save Changes" : "Create Post"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Enter post title…"
            error={
              formError && !form.title ? "Title is required" : undefined
            }
          />
          {!editingPost && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows={8}
                placeholder="Write your post content…"
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as PostStatus }))
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Post"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Permanently delete <strong>{deleteTarget?.title}</strong>? This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
