"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { getUsers, updateUser } from "@/lib/api/auth";
import type { AuthUser } from "@/lib/api/auth-schemas";
import { useAuth } from "./auth-provider";
import { buttonClass, inputClass } from "./auth-form";

export function AdminUsers() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users", session?.user.id, page, search],
    queryFn: ({ signal }) => getUsers(session!.access, page, search, signal),
    enabled: session?.user.role === "admin",
    retry: false,
  });
  const mutation = useMutation({
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
  function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(
      String(new FormData(event.currentTarget).get("search") ?? "").trim(),
    );
  }
  function update(
    user: AuthUser,
    changes: { role?: "admin" | "user"; is_active?: boolean },
  ) {
    setMessage(null);
    mutation.mutate({ id: user.id, changes });
  }
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
        Administration
      </p>
      <h1 className="mt-3 text-4xl font-bold">Users and roles</h1>
      <p className="mt-3 text-[var(--muted)]">
        Manage account access and application administrators.
      </p>
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
      {mutation.error && (
        <p role="alert" className="mb-5 text-[var(--danger)]">
          {mutation.error.message}
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
                          disabled={protectedUser || mutation.isPending}
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
                          disabled={protectedUser || mutation.isPending}
                          aria-label={`${user.is_active ? "Deactivate" : "Activate"} ${user.username}`}
                          onClick={() =>
                            update(user, { is_active: !user.is_active })
                          }
                          className="mt-2 font-semibold text-[var(--accent)] disabled:opacity-40"
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
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
