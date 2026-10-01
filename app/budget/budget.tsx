"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

const travelers = ["Iffah Afiqah", "Syahindah Batrishia", "Syauqina Qistina"];
const categories = [
  { id: "food", label: "Food & Drinks", icon: "food", tone: "rose" },
  { id: "activities", label: "Tickets & Activities", icon: "ticket", tone: "amber" },
  { id: "transport", label: "Transportation", icon: "car", tone: "blue" },
] as const;

type CategoryId = (typeof categories)[number]["id"];
type BudgetItem = {
  id: string;
  category: CategoryId;
  item_name: string;
  description: string;
  amount: number;
  status: string;
  route_or_day: string;
  is_shared: boolean;
  created_by: string;
};

type BudgetDraft = Omit<BudgetItem, "id">;
const blankDraft: BudgetDraft = {
  category: "food",
  item_name: "",
  description: "",
  amount: 0,
  status: "planned",
  route_or_day: "",
  is_shared: true,
  created_by: travelers[0],
};

function Icon({
  name,
  size = 18,
}: {
  name: "food" | "ticket" | "car" | "edit" | "trash" | "close" | "plus" | "users" | "wallet";
  size?: number;
}) {
  const paths = {
    food: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M16 3v7m0 0h4V3m-4 7v11" /></>,
    ticket: <><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a3 3 0 0 0 0-6Z" /><path d="M13 5v2m0 3v2m0 3v2m0 3v1" /></>,
    car: <><path d="m5 11 1.5-5h11l1.5 5m2 0H3v8h18v-8ZM6 19v2m12-2v2M6 15h.01M18 15h.01M4 11l-1 3m17-3 1 3" /></>,
    edit: <path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.2 15.1 4 20Z" />,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87m-1-11.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function formatRM(value: number) {
  return `RM${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const parts = [Reflect.get(error, "message"), Reflect.get(error, "details"), Reflect.get(error, "hint")]
      .filter((part): part is string => typeof part === "string" && Boolean(part));
    if (parts.length) return parts.join(" ");
  }
  return "An unknown database error occurred.";
}

export default function Budget({ traveler }: { traveler: string }) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [view, setView] = useState<"person" | "group">("person");
  const [selectedTraveler, setSelectedTraveler] = useState(traveler);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [draft, setDraft] = useState<BudgetDraft>({ ...blankDraft, created_by: traveler });
  const [isSaving, setIsSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("budget_items")
        .select("id, category, item_name, description, amount, status, route_or_day, is_shared, created_by")
        .order("category", { ascending: true })
        .order("item_name", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as BudgetItem[]);
      setLoadFailed(false);
      setErrorMessage(null);
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to load budget items: ${message}`);
      setLoadFailed(true);
      setErrorMessage(`We couldn’t load the shared budget: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Synchronize the budget view with the shared database on entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems();
  }, [loadItems]);

  const totals = useMemo(() => {
    const group = Object.fromEntries(categories.map((category) => [
      category.id,
      items.filter((item) => item.category === category.id).reduce((sum, item) => sum + Number(item.amount), 0),
    ])) as Record<CategoryId, number>;
    const person = Object.fromEntries(categories.map((category) => [
      category.id,
      items.filter((item) => item.category === category.id).reduce(
        (sum, item) =>
          sum +
          (item.is_shared
            ? Number(item.amount) / travelers.length
            : item.created_by === selectedTraveler
              ? Number(item.amount)
              : 0),
        0,
      ),
    ])) as Record<CategoryId, number>;
    return { group, person };
  }, [items, selectedTraveler]);

  const currentTotals = view === "group" ? totals.group : totals.person;
  const total = categories.reduce((sum, category) => sum + currentTotals[category.id], 0);
  const groupTotal = categories.reduce((sum, category) => sum + totals.group[category.id], 0);
  const perPersonEstimate = groupTotal / travelers.length;
  const budgetLimit = 1000;
  const progressLimit = view === "person" ? budgetLimit : budgetLimit * travelers.length;
  const budgetProgress = Math.min((total / progressLimit) * 100, 100);

  function openNewItem(category: CategoryId) {
    setEditingItem(null);
    setDraft({ ...blankDraft, category, created_by: selectedTraveler });
    setIsEditorOpen(true);
  }

  function openEditItem(item: BudgetItem) {
    setEditingItem(item);
    setDraft({
      category: item.category,
      item_name: item.item_name,
      description: item.description ?? "",
      amount: Number(item.amount),
      status: item.status,
      route_or_day: item.route_or_day ?? "",
      is_shared: item.is_shared,
      created_by: item.created_by,
    });
    setIsEditorOpen(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    const payload = { ...draft, created_by: selectedTraveler };

    try {
      const supabase = createClient();
      const result = editingItem
        ? await supabase.from("budget_items").update(payload).eq("id", editingItem.id)
        : await supabase.from("budget_items").insert(payload);
      if (result.error) throw result.error;
      setIsEditorOpen(false);
      await loadItems();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to save budget item: ${message}`);
      setErrorMessage(`We couldn’t save this item: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteItem(item: BudgetItem) {
    if (!window.confirm(`Delete “${item.item_name}” from the budget?`)) return;
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("budget_items").delete().eq("id", item.id);
      if (error) throw error;
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to delete budget item: ${message}`);
      setErrorMessage(`We couldn’t delete this item: ${message}`);
    }
  }

  return (
    <main className="itinerary-page budget-page">
      <header className="itinerary-topbar">
        <Link className="itinerary-brand" href="/" aria-label="Back to traveler selection">
          <span className="itinerary-brand-mark">✳</span>
          <strong>Trip WanderSync</strong>
        </Link>
        <nav className="itinerary-nav" aria-label="Trip sections">
          <Link href={`/itinerary?traveler=${encodeURIComponent(traveler)}`}>Itinerary</Link>
          <span className="nav-active">Budget</span>
          <Link href={`/roles?traveler=${encodeURIComponent(traveler)}`}>Roles</Link>
          <Link href={`/checklists?traveler=${encodeURIComponent(traveler)}`}>Checklists</Link>
          <Link href={`/splitwise?traveler=${encodeURIComponent(traveler)}`}>Splitwise</Link>
          <Link href={`/booking-vault?traveler=${encodeURIComponent(traveler)}`}>Booking Vault</Link>
          <Link href={`/transit?traveler=${encodeURIComponent(traveler)}`}>Transit</Link>
        </nav>
        <label className="active-traveler traveler-picker">
          <span className="mini-avatar">{selectedTraveler.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span>
          <select value={selectedTraveler} onChange={(event) => setSelectedTraveler(event.target.value)} aria-label="Selected traveler">
            {travelers.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
      </header>

      <div className="budget-shell">
        <div className="budget-heading">
          <div>
            <span className="itinerary-eyebrow">SHARED SPENDING PLAN</span>
            <h1>Budget &amp; expenses</h1>
            <p>A simple estimate to keep every stop enjoyable and spending transparent.</p>
          </div>
          <div className="budget-view-toggle" role="group" aria-label="Budget totals view">
            <button className={view === "person" ? "active" : ""} type="button" aria-pressed={view === "person"} onClick={() => setView("person")}>Per person</button>
            <button className={view === "group" ? "active" : ""} type="button" aria-pressed={view === "group"} onClick={() => setView("group")}>Group view</button>
          </div>
        </div>

        <div className="budget-category-summary">
          {categories.map((category) => (
            <article className="budget-summary-card" key={category.id}>
              <div className={`budget-category-icon ${category.tone}`}><Icon name={category.icon} size={17} /></div>
              <span>{category.label}</span>
              <strong>{formatRM(currentTotals[category.id])}</strong>
              {view === "person" && <small>per traveler</small>}
            </article>
          ))}
        </div>

        <section className="budget-estimate">
          <div>
            <span>{view === "group" ? "GROUP ESTIMATE" : "TRIP ESTIMATE"}</span>
            <strong>
              {view === "person"
                ? `Estimated Total per Person: ${formatRM(perPersonEstimate)}`
                : `Estimated Group Total: ${formatRM(total)}`}
            </strong>
          </div>
          <div className="budget-progress-wrap">
            <div className="budget-progress-label"><span>Budget plan</span><strong>{Math.round(budgetProgress)}%</strong></div>
            <div className="budget-progress"><span style={{ width: `${budgetProgress}%` }} /></div>
            <small>
              {view === "person"
                ? `${formatRM(total)} of ${formatRM(budgetLimit)} per person`
                : `${formatRM(total)} of ${formatRM(progressLimit)} group budget`}
            </small>
          </div>
        </section>

        {errorMessage && (
          <div className="itinerary-alert" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => { setIsLoading(true); void loadItems(); }}>Retry</button>
          </div>
        )}

        {isLoading ? (
          <div className="activity-loading" role="status">Loading your shared budget…</div>
        ) : loadFailed ? (
          <div className="activity-loading">The budget is unavailable until its Supabase setup is complete.</div>
        ) : (
          <div className="budget-category-list">
            {categories.map((category) => {
              const categoryItems = items.filter((item) => item.category === category.id);
              return (
                <section className="budget-category-panel" key={category.id}>
                  <div className="budget-category-header">
                    <div className={`budget-category-icon ${category.tone}`}><Icon name={category.icon} size={17} /></div>
                    <div className="budget-category-title">
                      <h2>{category.label}</h2>
                      <span>Subtotal: {formatRM(currentTotals[category.id])}{view === "person" ? " per person" : ""}</span>
                    </div>
                    <button className="budget-add-button" type="button" onClick={() => openNewItem(category.id)}>
                      <Icon name="plus" size={15} /> Add item
                    </button>
                  </div>
                  {categoryItems.length === 0 ? (
                    <div className="budget-empty">No items yet. Add your first {category.label.toLowerCase()} expense.</div>
                  ) : (
                    categoryItems.map((item) => (
                      <article className="budget-item-row" key={item.id}>
                        <div className="budget-item-copy">
                          <span className="budget-item-route">{item.route_or_day || "TRIP EXPENSE"} · {item.is_shared ? "SHARED POOL" : item.created_by.toUpperCase()}</span>
                          <strong>{item.item_name}</strong>
                          <span className="budget-item-description">{item.description || item.status}</span>
                          <span className={`budget-status ${item.status.replaceAll("_", "-")}`}>{item.status.replaceAll("_", " ")}</span>
                        </div>
                        <div className="budget-item-actions">
                          <strong>{formatRM(view === "person"
                            ? item.is_shared
                              ? Number(item.amount) / travelers.length
                              : item.created_by === selectedTraveler ? Number(item.amount) : 0
                            : Number(item.amount))}</strong>
                          <button type="button" aria-label={`Edit ${item.item_name}`} onClick={() => openEditItem(item)}><Icon name="edit" size={16} /></button>
                          <button type="button" aria-label={`Delete ${item.item_name}`} onClick={() => void deleteItem(item)}><Icon name="trash" size={16} /></button>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {isEditorOpen && (
        <div className="editor-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsEditorOpen(false);
        }}>
          <section className="activity-editor budget-editor" role="dialog" aria-modal="true" aria-labelledby="budget-editor-title">
            <div className="editor-header">
              <div><span className="editor-kicker">TRIP EDITOR</span><h2 id="budget-editor-title">{editingItem ? "Edit budget item" : "Add budget item"}</h2></div>
              <button className="editor-close" type="button" aria-label="Close form" onClick={() => setIsEditorOpen(false)} disabled={isSaving}><Icon name="close" size={21} /></button>
            </div>
            <form className="activity-form budget-form" onSubmit={saveItem}>
              <label><span>Category <b>*</b></span>
                <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as CategoryId })}>
                  {categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
                </select>
              </label>
              <label><span>Route or day <b>*</b></span>
                <input required maxLength={80} value={draft.route_or_day} onChange={(event) => setDraft({ ...draft, route_or_day: event.target.value })} placeholder="e.g. Day 1 · Sunway" />
              </label>
              <label><span>Item name <b>*</b></span>
                <input required maxLength={120} value={draft.item_name} onChange={(event) => setDraft({ ...draft, item_name: event.target.value })} placeholder="e.g. Sunway Lagoon tickets" />
              </label>
              <label><span>Description</span>
                <input maxLength={250} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What is this expense for?" />
              </label>
              <div className="form-grid">
                <label><span>Amount (RM) <b>*</b></span>
                  <input type="number" required min="0.01" max="999999" step="0.01" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} placeholder="0.00" />
                </label>
                <label><span>Payment / status <b>*</b></span>
                  <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                    <option value="planned">Planned</option><option value="booked">Booked</option><option value="to_pay">To pay</option><option value="paid">Paid</option>
                  </select>
                </label>
              </div>
              <label className="shared-expense-toggle">
                <input type="checkbox" checked={draft.is_shared} onChange={(event) => setDraft({ ...draft, is_shared: event.target.checked })} />
                <span><strong>Split this cost between all travelers</strong><small>Shared expenses are divided equally between the three travelers.</small></span>
                <Icon name="users" size={19} />
              </label>
              <div className="budget-editor-footer">
                <span>Changes are shared with your trip group.</span>
                <div>
                  <button type="button" className="cancel-budget-button" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>Cancel</button>
                  <button type="submit" className="save-activity-button" disabled={isSaving}>{isSaving ? "Saving…" : editingItem ? "Save changes" : "Add budget item"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
