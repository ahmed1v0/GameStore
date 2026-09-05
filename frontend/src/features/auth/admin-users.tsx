"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import { getUsers, inviteUser, updateUser } from "@/lib/api/auth";
import type { AuthUser } from "@/lib/api/auth-schemas";
import { useAuth } from "./auth-provider";
import { buttonClass, inputClass } from "./auth-styles";

export function AdminUsers() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteForm = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users", session?.user.id, page, search],
    queryFn: ({ signal }) => getUsers(session!.access, page, search, signal),
    enabled: session?.user.role === "admin",
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: { role?: "admin" | "user"; is_active?: boolean };
    }) => updateUser(session!.access, id, changes),
    onSuccess() {
      setMessage("Account updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (invitation: {
      username: string;
      email: string;
      role: "admin" | "user";
    }) => inviteUser(session!.access, invitation),
    onSuccess(user) {
      setMessage(`Invitation created for ${user.email}.`);
      inviteForm.current?.reset();
      setInviteOpen(false);
      setPage(1);
      setSearch("");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(
      String(new FormData(event.currentTarget).get("search") ?? "").trim(),
    );
  }

  function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const values = new FormData(event.currentTarget);
    inviteMutation.mutate({
      username: String(values.get("username") ?? "").trim(),
      email: String(values.get("email") ?? "").trim(),
      role: values.get("role") === "admin" ? "admin" : "user",
    });
  }

  function update(
    user: AuthUser,
    changes: { role?: "admin" | "user"; is_active?: boolean },
  ) {
    setMessage(null);
    updateMutation.mutate({ id: user.id, changes });
  }

  const mutationError = inviteMutation.error ?? updateMutation.error;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold">Users and roles</h1>
          <p className="mt-3 text-[var(--muted)]">
            Manage account access and application administrators.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setMessage(null);
            setInviteOpen((current) => !current);
          }}
          aria-expanded={inviteOpen}
          aria-controls="invite-user-form"
        >
          {inviteOpen ? "Cancel invitation" : "Invite user"}
        </button>
      </div>

      {inviteOpen && (
        <form
          ref={inviteForm}
          id="invite-user-form"
          className="mt-8 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2"
          onSubmit={submitInvitation}
        >
          <div className="sm:col-span-2">
            <h2 className="text-xl font-bold">Invite a new account</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The user receives a one-time link to choose their own password.
            </p>
          </div>

          <label>
            <span className="mb-2 block text-sm font-semibold">Username</span>
            <input
              name="username"
              required
              maxLength={150}
              autoComplete="off"
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-semibold">Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-semibold">
              Initial role
            </span>
            <select name="role" defaultValue="user" className={inputClass}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              className={`${buttonClass} w-full`}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Creating invitation…" : "Send invitation"}
            </button>
          </div>
        </form>
      )}

      <form className="my-8 flex max-w-xl gap-3" onSubmit={searchUsers}>
        <label className="flex-1">
          <span className="sr-only">Search users</span>
          <input
            name="search"
            type="search"
            placeholder="Search username or email"
            className={inputClass}
          />
        </label>
        <button className={buttonClass}>Search</button>
      </form>

      {message && (
        <p role="status" className="mb-5 text-[var(--accent)]">
          {message}
        </p>
      )}

      {mutationError && (
        <p role="alert" className="mb-5 text-[var(--danger)]">
          {mutationError.message}
        </p>
      )}

      {users.isPending ? (
        <p role="status">Loading users…</p>
      ) : users.isError ? (
        <div role="alert">
          <p className="text-[var(--danger)]">{users.error.message}</p>
          <button
            className={`${buttonClass} mt-4`}
            onClick={() => void users.refetch()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Registered accounts and access controls
              </caption>
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  {["Account", "Email status", "Role", "Access"].map(
                    (label) => (
                      <th scope="col" key={label} className="p-4">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {users.data.results.map((user) => {
                  const protectedUser =
                    user.is_superuser || user.id === session!.user.id;
                  const updatingThisUser =
                    updateMutation.isPending &&
                    updateMutation.variables?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="p-4">
                        <span className="font-bold">{user.username}</span>
                        {user.id === session!.user.id && " (you)"}
                        <span className="mt-1 block text-[var(--muted)]">
                          {user.email || "No email"}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.email_verified
                          ? "Verified"
                          : user.verification_required
                            ? "Pending"
                            : "Exempt"}
                      </td>
                      <td className="p-4">
                        <select
                          aria-label={`Role for ${user.username}`}
                          value={user.role}
                          disabled={protectedUser || updatingThisUser}
                          onChange={(event) =>
                            update(user, {
                              role: event.target.value as "admin" | "user",
                            })
                          }
                          className={`${inputClass} min-w-28 disabled:opacity-60`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        {user.is_superuser && (
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            Superuser
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="block">
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                        <button
                          type="button"
                          disabled={protectedUser || updatingThisUser}
                          aria-label={`${user.is_active ? "Deactivate" : "Activate"} ${user.username}`}
                          onClick={() =>
                            update(user, { is_active: !user.is_active })
                          }
                          className="mt-2 font-semibold text-[var(--accent)] disabled:opacity-40"
                        >
                          {updatingThisUser
                            ? "Updating…"
                            : user.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {users.data.count === 0 && (
              <p className="p-8 text-center text-[var(--muted)]">
                No matching accounts.
              </p>
            )}
          </div>

          <nav
            aria-label="User pagination"
            className="mt-6 flex items-center justify-between"
          >
            <button
              className={buttonClass}
              disabled={!users.data.previous || users.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <p>
              Page {page} · {users.data.count} users
            </p>
            <button
              className={buttonClass}
              disabled={!users.data.next || users.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
