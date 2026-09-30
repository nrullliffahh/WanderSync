"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

type ChecklistGroup = {
  id: number;
  title: string;
  short_title: string;
  owner_traveler_id: number | null;
};

type GroupVisibility = "shared" | "personal";

type ChecklistItem = {
  id: string;
  group_id: number;
  item_name: string;
  is_done: boolean;
  assigned_traveler_id: number | null;
};

type TravelerRecord = {
  id: number;
  name: string;
};

const defaultGroups = [
  "Pre-Departure",
  "Personal packing",
  "Shared gear",
  "Cooking & grocery",
];

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

function Icon({ name, size = 18 }: { name: "edit" | "trash" | "plus" | "close"; size?: number }) {
  const paths = {
    edit: <path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.2 15.1 4 20Z" />,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function Checklists({ traveler }: { traveler: string }) {
  const [groups, setGroups] = useState<ChecklistGroup[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [travelerId, setTravelerId] = useState<number | null>(null);
  const [travelers, setTravelers] = useState<TravelerRecord[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [itemName, setItemName] = useState("");
  const [assignedTravelerId, setAssignedTravelerId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ChecklistGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupVisibility, setGroupVisibility] = useState<GroupVisibility>("personal");

  const loadChecklist = useCallback(async () => {
    try {
      const supabase = createClient();
      const [
        { data: travelerData, error: travelerError },
        { data: travelerListData, error: travelerListError },
      ] = await Promise.all([
        supabase.from("travelers").select("id, name").eq("name", traveler).maybeSingle(),
        supabase.from("travelers").select("id, name").order("id"),
      ]);
      if (travelerError) throw travelerError;
      if (travelerListError) throw travelerListError;
      if (!travelerData) {
        throw new Error(`Traveler profile "${traveler}" was not found.`);
      }

      const currentTraveler = travelerData as TravelerRecord;
      setTravelers((travelerListData ?? []) as TravelerRecord[]);
      const { data: groupData, error: groupError } = await supabase
        .from("checklist_groups")
        .select("id, title, short_title, owner_traveler_id")
        .or(`owner_traveler_id.is.null,owner_traveler_id.eq.${currentTraveler.id}`)
        .order("id");
      if (groupError) throw groupError;

      const visibleGroups = (groupData ?? []) as ChecklistGroup[];
      const groupIds = visibleGroups.map((group) => group.id);
      const { data: itemData, error: itemError } = groupIds.length
        ? await supabase
            .from("checklist_items")
            .select("id, group_id, item_name, assigned_traveler_id")
            .in("group_id", groupIds)
            .order("item_name")
        : { data: [], error: null };
      if (itemError) throw itemError;

      const loadedItems = (itemData ?? []).map((item) => ({
        ...item,
        id: String(item.id),
      }));
      const groupById = new Map(visibleGroups.map((group) => [group.id, group]));
      const sharedItemIds = loadedItems
        .filter((item) => groupById.get(item.group_id)?.owner_traveler_id === null)
        .map((item) => item.id);
      const [{ data: personalCompletionData, error: personalCompletionError }, { data: sharedCompletionData, error: sharedCompletionError }] =
        await Promise.all([
          supabase
            .from("checklist_item_completions")
            .select("checklist_item_id")
            .eq("traveler_id", currentTraveler.id),
          sharedItemIds.length
            ? supabase
                .from("checklist_shared_item_completions")
                .select("checklist_item_id")
                .in("checklist_item_id", sharedItemIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (personalCompletionError) throw personalCompletionError;
      if (sharedCompletionError) throw sharedCompletionError;
      const personalCompletedItemIds = new Set(
        (personalCompletionData ?? []).map((completion) => String(completion.checklist_item_id)),
      );
      const sharedCompletedItemIds = new Set(
        (sharedCompletionData ?? []).map((completion) => String(completion.checklist_item_id)),
      );
      setGroups(visibleGroups);
      setTravelerId(currentTraveler.id);
      setItems(loadedItems.map((item) => ({
          ...item,
          is_done: groupById.get(item.group_id)?.owner_traveler_id === null
            ? sharedCompletedItemIds.has(item.id)
            : personalCompletedItemIds.has(item.id),
          assigned_traveler_id: item.assigned_traveler_id === null
            ? null
            : Number(item.assigned_traveler_id),
        })) as ChecklistItem[]);
      setActiveGroupId((current) =>
        current !== null && visibleGroups.some((group) => group.id === current)
          ? current
          : visibleGroups[0]?.id ?? null,
      );
      setLoadFailed(false);
      setErrorMessage(null);
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to load checklist: ${message}`);
      setLoadFailed(true);
      setErrorMessage(`We couldn’t load ${traveler}’s checklist: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [traveler]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const hasSharedGroups = groups.some((group) => group.owner_traveler_id === null);

  useEffect(() => {
    // Shared categories use common completion state; personal categories use this traveler's state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadChecklist();
  }, [loadChecklist]);

  useEffect(() => {
    if (!hasSharedGroups) return;

    const supabase = createClient();
    const channel = supabase
      .channel("shared-checklist-completions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_shared_item_completions" },
        () => void loadChecklist(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hasSharedGroups, loadChecklist]);

  const visibleItems = useMemo(
    () => items.filter((item) => item.group_id === activeGroupId),
    [items, activeGroupId],
  );
  const completedCount = visibleItems.filter((item) => item.is_done).length;
  const progress = visibleItems.length
    ? Math.round((completedCount / visibleItems.length) * 100)
    : 0;

  function openAddItem() {
    setEditingItem(null);
    setItemName("");
    setAssignedTravelerId("");
    setIsEditorOpen(true);
  }

  function openAddGroup() {
    setEditingGroup(null);
    setGroupName("");
    setGroupVisibility("personal");
    setIsGroupEditorOpen(true);
  }

  function openEditGroup(group: ChecklistGroup) {
    setEditingGroup(group);
    setGroupName(group.title);
    setGroupVisibility(group.owner_traveler_id === null ? "shared" : "personal");
    setIsGroupEditorOpen(true);
  }

  function openEditItem(item: ChecklistItem) {
    setEditingItem(item);
    setItemName(item.item_name);
    setAssignedTravelerId(
      item.assigned_traveler_id === null ? "" : String(item.assigned_traveler_id),
    );
    setIsEditorOpen(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || activeGroupId === null) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const assignedTo = activeGroup?.owner_traveler_id === null && assignedTravelerId
        ? Number(assignedTravelerId)
        : null;
      const result = editingItem
        ? await supabase
            .from("checklist_items")
            .update({ item_name: itemName.trim(), assigned_traveler_id: assignedTo })
            .eq("id", editingItem.id)
        : await supabase.from("checklist_items").insert({
            group_id: activeGroupId,
            item_name: itemName.trim(),
            is_done: false,
            assigned_traveler_id: assignedTo,
          });

      if (result.error) throw result.error;
      setIsEditorOpen(false);
      await loadChecklist();
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to save checklist item: ${message}`);
      setErrorMessage(`We couldn’t save this item: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = groupName.trim();
    if (isSaving || !title || travelerId === null) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const ownerTravelerId = groupVisibility === "personal" ? travelerId : null;
      const result = editingGroup
        ? await supabase
            .from("checklist_groups")
            .update({ title, short_title: title, owner_traveler_id: ownerTravelerId })
            .eq("id", editingGroup.id)
        : await supabase
            .from("checklist_groups")
            .insert({ title, short_title: title, owner_traveler_id: ownerTravelerId })
            .select("id")
            .single();

      if (result.error) throw result.error;
      setIsGroupEditorOpen(false);
      await loadChecklist();
      if (!editingGroup && result.data) {
        setActiveGroupId(result.data.id);
      }
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to save checklist category: ${message}`);
      setErrorMessage(`We couldn’t save this category: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteGroup(group: ChecklistGroup) {
    if (!window.confirm(`Delete “${group.title}” and all its checklist items?`)) return;
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_checklist_group", {
        p_group_id: group.id,
      });
      if (error) throw error;
      setActiveGroupId(null);
      await loadChecklist();
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to delete checklist category: ${message}`);
      setErrorMessage(`We couldn’t delete this category: ${message}`);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    setErrorMessage(null);
    if (travelerId === null) {
      setErrorMessage("Your traveler profile is still loading. Please try again.");
      return;
    }

    try {
      const supabase = createClient();
      const isShared = activeGroup?.owner_traveler_id === null;
      const result = isShared
        ? item.is_done
          ? await supabase
              .from("checklist_shared_item_completions")
              .delete()
              .eq("checklist_item_id", item.id)
          : await supabase.from("checklist_shared_item_completions").insert({
              checklist_item_id: item.id,
            })
        : item.is_done
          ? await supabase
              .from("checklist_item_completions")
              .delete()
              .eq("checklist_item_id", item.id)
              .eq("traveler_id", travelerId)
          : await supabase.from("checklist_item_completions").insert({
              checklist_item_id: item.id,
              traveler_id: travelerId,
            });
      const { error } = result;
      if (error) throw error;
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, is_done: !item.is_done }
            : currentItem,
        ),
      );
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to update checklist item: ${message}`);
      setErrorMessage(`We couldn’t update this item: ${message}`);
    }
  }

  async function deleteItem(item: ChecklistItem) {
    if (!window.confirm(`Remove “${item.item_name}” from this checklist?`)) return;
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("checklist_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to delete checklist item: ${message}`);
      setErrorMessage(`We couldn’t remove this item: ${message}`);
    }
  }

  return (
    <main className="itinerary-page checklists-page">
      <header className="itinerary-topbar">
        <Link className="itinerary-brand" href="/" aria-label="Back to traveler selection">
          <span className="itinerary-brand-mark">✳</span>
          <strong>Trip WanderSync</strong>
        </Link>
        <nav className="itinerary-nav" aria-label="Trip sections">
          <Link href={`/itinerary?traveler=${encodeURIComponent(traveler)}`}>Itinerary</Link>
          <Link href={`/budget?traveler=${encodeURIComponent(traveler)}`}>Budget</Link>
          <Link href={`/roles?traveler=${encodeURIComponent(traveler)}`}>Roles</Link>
          <span className="nav-active">Checklists</span>
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

      <div className="checklists-shell">
        <div className="checklists-heading">
          <div>
            <span className="itinerary-eyebrow">READY, SET, WANDER</span>
            <h1>Trip checklists</h1>
            <p>Shared lists show the same ticks to everyone; personal lists keep your own progress.</p>
          </div>
          <button className="add-activity-button" type="button" onClick={openAddItem} disabled={groups.length === 0}>
            <Icon name="plus" size={17} /> Add item
          </button>
        </div>

        {errorMessage && (
          <div className="itinerary-alert" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => { setIsLoading(true); void loadChecklist(); }}>Retry</button>
          </div>
        )}

        {isLoading ? (
          <div className="activity-loading" role="status">Loading your shared checklists…</div>
        ) : loadFailed ? (
          <div className="activity-loading">Checklists are unavailable until the Supabase setup is complete.</div>
        ) : groups.length === 0 ? (
          <div className="checklist-empty checklist-no-categories">
            <span className="checklist-empty-mark">✳</span>
            <strong>No checklist categories yet</strong>
            <span>Create a shared category or one just for you.</span>
            <button type="button" onClick={openAddGroup}>Add a category</button>
          </div>
        ) : (
          <>
            <div className="checklist-tabs" role="tablist" aria-label="Checklist groups">
              {groups.map((group, index) => (
                <button
                  className={`checklist-tab${activeGroupId === group.id ? " checklist-tab-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={activeGroupId === group.id}
                  key={group.id}
                  onClick={() => setActiveGroupId(group.id)}
                >
                  {defaultGroups.includes(group.title) ? group.title : group.title || `Checklist ${index + 1}`}
                </button>
              ))}
              <button className="checklist-tab-add" type="button" onClick={openAddGroup}>
                <Icon name="plus" size={16} /> Add category
              </button>
            </div>

            <section className="checklist-panel" aria-labelledby="checklist-title">
              <div className="checklist-panel-heading">
                <div>
                    <span className="section-kicker">
                      {activeGroup?.owner_traveler_id === null ? "SHARED WITH ALL TRAVELERS" : `PERSONAL LIST · ${traveler}`}
                    </span>
                    <h2 id="checklist-title">{activeGroup?.title ?? "Checklist"}</h2>
                  </div>
                <div className="checklist-group-actions">
                  <button type="button" aria-label={`Edit ${activeGroup?.title ?? "category"}`} onClick={() => activeGroup && openEditGroup(activeGroup)}>
                    <Icon name="edit" size={16} />
                  </button>
                  <button type="button" aria-label={`Delete ${activeGroup?.title ?? "category"}`} onClick={() => activeGroup && void deleteGroup(activeGroup)}>
                    <Icon name="trash" size={16} />
                  </button>
                  <span className="checklist-progress-count">{completedCount} / {visibleItems.length}</span>
                </div>
              </div>
              <div className="checklist-progress"><span style={{ width: `${progress}%` }} /></div>

              {visibleItems.length === 0 ? (
                <div className="checklist-empty">
                  <span className="checklist-empty-mark">✳</span>
                  <strong>This list is ready for your plans</strong>
                  <span>Add a checklist item to get started.</span>
                  <button type="button" onClick={openAddItem}>Add the first item</button>
                </div>
              ) : (
                <div className="checklist-items">
                  {visibleItems.map((item) => (
                    <article className={`checklist-item${item.is_done ? " checklist-item-done" : ""}`} key={item.id}>
                      <label className="checklist-item-main">
                        <input type="checkbox" checked={item.is_done} onChange={() => void toggleItem(item)} />
                        <span className="checklist-checkmark" aria-hidden="true">{item.is_done ? "✓" : ""}</span>
                        <span className="checklist-item-copy">
                          <span>{item.item_name}</span>
                          {activeGroup?.owner_traveler_id === null && item.assigned_traveler_id !== null && (
                            <small>
                              Brought by {travelers.find((person) => person.id === item.assigned_traveler_id)?.name ?? "Traveler"}
                            </small>
                          )}
                        </span>
                      </label>
                      <div className="checklist-item-actions">
                        <button type="button" aria-label={`Edit ${item.item_name}`} onClick={() => openEditItem(item)}><Icon name="edit" size={17} /></button>
                        <button type="button" aria-label={`Delete ${item.item_name}`} onClick={() => void deleteItem(item)}><Icon name="trash" size={17} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {isEditorOpen && (
        <div className="editor-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsEditorOpen(false);
        }}>
          <section className="activity-editor checklist-editor" role="dialog" aria-modal="true" aria-labelledby="checklist-editor-title">
            <div className="editor-header">
              <div><span className="editor-kicker">TRIP EDITOR</span><h2 id="checklist-editor-title">{editingItem ? "Edit list item" : "Add list item"}</h2></div>
              <button className="editor-close" type="button" aria-label="Close checklist form" onClick={() => setIsEditorOpen(false)} disabled={isSaving}><Icon name="close" size={22} /></button>
            </div>
            <form className="activity-form checklist-form" onSubmit={saveItem}>
              <label>
                <span>Item <b>*</b></span>
                <input autoFocus required maxLength={160} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. Online ticket confirmations" />
              </label>
              {activeGroup?.owner_traveler_id === null && (
                <label className="checklist-assignee-field">
                  <span>Who should bring this?</span>
                  <select
                    value={assignedTravelerId}
                    onChange={(event) => setAssignedTravelerId(event.target.value)}
                  >
                    <option value="">Not assigned yet</option>
                    {travelers.map((person) => (
                      <option key={person.id} value={person.id}>{person.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="checklist-editor-footer">
                <button type="button" className="cancel-budget-button" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>Cancel</button>
                <button type="submit" className="save-activity-button" disabled={isSaving}>{isSaving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isGroupEditorOpen && (
        <div className="editor-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsGroupEditorOpen(false);
        }}>
          <section className="activity-editor checklist-editor" role="dialog" aria-modal="true" aria-labelledby="checklist-group-editor-title">
            <div className="editor-header">
              <div><span className="editor-kicker">CHECKLIST CATEGORIES</span><h2 id="checklist-group-editor-title">{editingGroup ? "Edit category" : "Add category"}</h2></div>
              <button className="editor-close" type="button" aria-label="Close category form" onClick={() => setIsGroupEditorOpen(false)} disabled={isSaving}><Icon name="close" size={22} /></button>
            </div>
            <form className="activity-form checklist-form" onSubmit={saveGroup}>
              <label>
                <span>Category name <b>*</b></span>
                <input autoFocus required maxLength={100} value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Documents" />
              </label>
              <fieldset className="checklist-visibility-field">
                <legend>Who can use this checklist?</legend>
                <label className={`checklist-visibility-option${groupVisibility === "shared" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="checklist-visibility"
                    value="shared"
                    checked={groupVisibility === "shared"}
                    onChange={() => setGroupVisibility("shared")}
                  />
                  <span><strong>Same for everyone</strong><small>All travelers see and manage this category.</small></span>
                </label>
                <label className={`checklist-visibility-option${groupVisibility === "personal" ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="checklist-visibility"
                    value="personal"
                    checked={groupVisibility === "personal"}
                    onChange={() => setGroupVisibility("personal")}
                  />
                  <span><strong>Just me</strong><small>Only {traveler} sees this category.</small></span>
                </label>
              </fieldset>
              {editingGroup && editingGroup.owner_traveler_id === null && groupVisibility === "personal" && (
                <p className="checklist-visibility-warning">
                  This shared category will disappear from the other travelers’ lists. Its checklist items will be kept.
                </p>
              )}
              <div className="checklist-editor-footer">
                <button type="button" className="cancel-budget-button" onClick={() => setIsGroupEditorOpen(false)} disabled={isSaving}>Cancel</button>
                <button type="submit" className="save-activity-button" disabled={isSaving}>{isSaving ? "Saving…" : editingGroup ? "Save changes" : "Add category"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
