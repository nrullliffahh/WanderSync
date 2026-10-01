"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

const travelers = ["Iffah Afiqah", "Syahindah Batrishia", "Syauqina Qistina"];

const roleSuggestions = [
  {
    name: "Trip Leader / PIC",
    description:
      "Master schedule coordination, final decision-making, pedestrian and public transit navigation.",
    assignee: travelers[0],
    icon: "compass",
  },
  {
    name: "Booking & Reservations",
    description:
      "Early ticket purchases, Colony Suites liaison, check-in/out procedures, and QR code storage.",
    assignee: travelers[1],
    icon: "ticket",
  },
  {
    name: "Lead Driver",
    description:
      "Vehicle navigation, toll management, and RFID / Touch 'n Go card balance monitoring.",
    assignee: travelers[2],
    icon: "car",
  },
  {
    name: "Treasurer / Money Master",
    description:
      "Shared pool fund management, collective payments, and transparent expense recording.",
    assignee: travelers[0],
    icon: "wallet",
  },
] as const;

type Role = {
  id: string;
  name: string;
  description: string;
  assignee_id: string | null;
  icon: string | null;
};

type Draft = {
  name: string;
  description: string;
  assignee_id: string;
};

function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></>,
    ticket: <><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a3 3 0 0 0 0-6Z" /><path d="M13 5v2m0 3v2m0 3v2m0 3v1" /></>,
    car: <><path d="m5 11 1.5-5h11l1.5 5m2 0H3v8h18v-8ZM6 19v2m12-2v2M6 15h.01M18 15h.01" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
    edit: <path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.2 15.1 4 20Z" />,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.compass}
    </svg>
  );
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const parts = [
      Reflect.get(error, "message"),
      Reflect.get(error, "details"),
      Reflect.get(error, "hint"),
    ].filter((part): part is string => typeof part === "string" && Boolean(part));
    if (parts.length > 0) return parts.join(" ");
  }
  return "An unknown database error occurred.";
}

export default function Roles({ traveler }: { traveler: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [travelerIds, setTravelerIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    description: "",
    assignee_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const supabase = createClient();
      const [{ data: roleData, error: roleError }, { data: travelerData, error: travelerError }] =
        await Promise.all([
          supabase
            .from("trip_roles")
            .select("id, name, description, assignee_id, icon")
            .order("name", { ascending: true }),
          supabase.from("travelers").select("id, name"),
        ]);

      if (roleError) throw roleError;
      if (travelerError) throw travelerError;

      const ids = Object.fromEntries(
        (travelerData ?? []).map((record) => [record.name, String(record.id)]),
      ) as Record<string, string>;
      setTravelerIds(ids);
      setRoles(
        (roleData ?? []).map((role) => ({
          ...role,
          id: String(role.id),
          assignee_id:
            role.assignee_id === null ? null : String(role.assignee_id),
        })) as Role[],
      );
      setLoadFailed(false);
      setErrorMessage(null);
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to load trip roles: ${message}`);
      setLoadFailed(true);
      setErrorMessage(`We couldn’t load trip roles: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the shared roles and traveler assignments on entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRoles();
  }, [loadRoles]);

  function startAddRole() {
    const initialAssignee =
      travelerIds[traveler] ?? Object.values(travelerIds)[0] ?? "";
    setEditingRole(null);
    setDraft({ name: "", description: "", assignee_id: initialAssignee });
    setIsEditorOpen(true);
  }

  function startEditRole(role: Role) {
    setEditingRole(role);
    setDraft({
      name: role.name,
      description: role.description,
      assignee_id:
        role.assignee_id ?? travelerIds[traveler] ?? Object.values(travelerIds)[0] ?? "",
    });
    setIsEditorOpen(true);
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        assignee_id: draft.assignee_id,
      };
      const result = editingRole
        ? await supabase
            .from("trip_roles")
            .update(payload)
            .eq("id", editingRole.id)
        : await supabase.from("trip_roles").insert(payload);

      if (result.error) throw result.error;
      setIsEditorOpen(false);
      await loadRoles();
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to save trip role: ${message}`);
      setErrorMessage(`We couldn’t save this role: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRole(role: Role) {
    if (role.id.startsWith("suggested:")) {
      setErrorMessage("Add the default role to Supabase before editing or removing it.");
      return;
    }
    if (!window.confirm(`Delete the “${role.name}” role?`)) return;

    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("trip_roles").delete().eq("id", role.id);
      if (error) throw error;
      setRoles((current) => current.filter((item) => item.id !== role.id));
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to delete trip role: ${message}`);
      setErrorMessage(`We couldn’t delete this role: ${message}`);
    }
  }

  const assigneeName = (role: Role) =>
    travelers.find((name) => travelerIds[name] === role.assignee_id) ?? "Unassigned";

  return (
    <main className="itinerary-page roles-page">
      <header className="itinerary-topbar">
        <Link className="itinerary-brand" href="/" aria-label="Back to traveler selection">
          <span className="itinerary-brand-mark">✳</span>
          <strong>Trip WanderSync</strong>
        </Link>
        <nav className="itinerary-nav" aria-label="Trip sections">
          <Link href={`/itinerary?traveler=${encodeURIComponent(traveler)}`}>Itinerary</Link>
          <Link href={`/budget?traveler=${encodeURIComponent(traveler)}`}>Budget</Link>
          <span className="nav-active">Roles</span>
          <Link href={`/checklists?traveler=${encodeURIComponent(traveler)}`}>Checklists</Link>
          <Link href={`/splitwise?traveler=${encodeURIComponent(traveler)}`}>Splitwise</Link>
          <Link href={`/booking-vault?traveler=${encodeURIComponent(traveler)}`}>Booking Vault</Link>
          <Link href={`/transit?traveler=${encodeURIComponent(traveler)}`}>Transit</Link>
        </nav>
        <Link className="active-traveler" href="/" title="Switch traveler">
          <span className="mini-avatar">{traveler.split(" ")[0][0]}</span>
          {traveler.split(" ")[0]}
          <span className="switch-label">Switch</span>
        </Link>
      </header>

      <div className="roles-shell">
        <div className="roles-heading">
          <div>
            <span className="itinerary-eyebrow">TRAVEL TEAMWORK</span>
            <h1>Roles &amp; responsibilities</h1>
            <p>Give every part of the journey a clear owner, then swap assignments whenever needed.</p>
          </div>
          <button className="add-activity-button" type="button" onClick={startAddRole}>
            <Icon name="plus" size={17} />
            Add role
          </button>
        </div>

        {errorMessage && (
          <div className="itinerary-alert" role="alert">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void loadRoles();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="activity-loading" role="status">Loading your shared roles…</div>
        ) : loadFailed ? (
          <div className="activity-loading">Roles are unavailable until the Supabase setup is complete.</div>
        ) : roles.length === 0 ? (
          <div className="roles-empty">
            <span className="roles-empty-icon"><Icon name="compass" size={22} /></span>
            <h2>Let&apos;s share the trip planning</h2>
            <p>Add the first responsibility and choose who will take the lead.</p>
            <button className="add-activity-button" type="button" onClick={startAddRole}>
              <Icon name="plus" size={16} /> Add the first role
            </button>
          </div>
        ) : (
          <div className="roles-grid">
            {roles.map((role, index) => {
              const suggestion = roleSuggestions.find(
                (item) => item.name.toLowerCase() === role.name.toLowerCase(),
              );
              const icon = role.icon ?? suggestion?.icon ?? ["compass", "ticket", "car", "wallet"][index % 4];
              return (
                <article className="role-card" key={role.id}>
                  <div className="role-card-top">
                    <span className="role-icon"><Icon name={icon} size={19} /></span>
                    <div className="role-card-actions">
                      <button type="button" aria-label={`Edit ${role.name}`} onClick={() => startEditRole(role)}><Icon name="edit" size={17} /></button>
                      <button type="button" aria-label={`Delete ${role.name}`} onClick={() => void deleteRole(role)}><Icon name="trash" size={17} /></button>
                    </div>
                  </div>
                  <h2>{role.name}</h2>
                  <p>{role.description}</p>
                  <span className="role-assignee-label">ASSIGNEE</span>
                  <strong className="role-assignee">{assigneeName(role)}</strong>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isEditorOpen && (
        <div className="editor-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsEditorOpen(false);
        }}>
          <section className="activity-editor role-editor" role="dialog" aria-modal="true" aria-labelledby="role-editor-title">
            <div className="editor-header">
              <div><span className="editor-kicker">TRIP EDITOR</span><h2 id="role-editor-title">{editingRole ? "Edit role" : "Add role"}</h2></div>
              <button className="editor-close" type="button" aria-label="Close role form" onClick={() => setIsEditorOpen(false)} disabled={isSaving}><Icon name="close" size={21} /></button>
            </div>
            <form className="activity-form" onSubmit={saveRole}>
              <label>
                <span>Role name <b>*</b></span>
                <input required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Snack coordinator" />
              </label>
              <label>
                <span>Role description <b>*</b></span>
                <textarea required rows={3} maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What will this person be responsible for?" />
              </label>
              <label>
                <span>Assignee <b>*</b></span>
                <select required value={draft.assignee_id} onChange={(event) => setDraft({ ...draft, assignee_id: event.target.value })}>
                  {travelers.map((name) => (
                    <option value={travelerIds[name] ?? ""} key={name} disabled={!travelerIds[name]}>{name}</option>
                  ))}
                </select>
              </label>
              <div className="role-editor-footer">
                <span>Role assignments are shared with your trip group.</span>
                <div>
                  <button className="cancel-budget-button" type="button" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>Cancel</button>
                  <button className="save-activity-button" type="submit" disabled={isSaving || Object.keys(travelerIds).length === 0}>{isSaving ? "Saving…" : "Save changes"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
