"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type Person = {
  id: string;
  name: string;
  created_at: string;
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  paid_by: string;
  expense_date: string;
  note: string;
  split_mode: "equally" | "custom";
  created_at: string;
};

type Share = {
  expense_id: string;
  person_id: string;
  share_amount: number;
};

type Settlement = {
  id: string;
  from_person_id: string;
  to_person_id: string;
  amount: number;
  settlement_date: string;
  note: string;
  proof_path: string | null;
  proof_url: string | null;
  created_at: string;
};

type ExpenseDraft = {
  name: string;
  amount: string;
  paid_by: string;
  expense_date: string;
  note: string;
  split_mode: "equally" | "custom";
};

type Debt = {
  from: Person;
  to: Person;
  amount: number;
};

const icons: Record<string, ReactNode> = {
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  plus: <path d="M12 5v14m-7-7h14" />,
  edit: <path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.2 15.1 4 20Z" />,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18m-5 5h2" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};

function Icon({ name, size = 18 }: { name: keyof typeof icons; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function formatRM(value: number) {
  return `RM${value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moneyInputCents(value: string) {
  if (!value) return 0;
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const parts = [Reflect.get(error, "message"), Reflect.get(error, "details"), Reflect.get(error, "hint")]
      .filter((part): part is string => typeof part === "string" && Boolean(part));
    if (parts.length) return parts.join(" ");
  }
  return "An unknown database error occurred.";
}

function calculateBalances(people: Person[], expenses: Expense[], shares: Share[], settlements: Settlement[]) {
  const balances = new Map(people.map((person) => [person.id, 0]));

  for (const expense of expenses) {
    const amountCents = Math.round(Number(expense.amount) * 100);
    balances.set(expense.paid_by, (balances.get(expense.paid_by) ?? 0) - amountCents);
  }

  for (const share of shares) {
    balances.set(share.person_id, (balances.get(share.person_id) ?? 0) + Math.round(Number(share.share_amount) * 100));
  }

  for (const settlement of settlements) {
    const amountCents = Math.round(Number(settlement.amount) * 100);
    balances.set(settlement.from_person_id, (balances.get(settlement.from_person_id) ?? 0) - amountCents);
    balances.set(settlement.to_person_id, (balances.get(settlement.to_person_id) ?? 0) + amountCents);
  }

  return balances;
}

function calculateDebts(
  people: Person[],
  expenses: Expense[],
  shares: Share[],
  settlements: Settlement[],
): Debt[] {
  const pairBalances = new Map<string, number>();
  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));

  function addPairBalance(fromId: string, toId: string, amountCents: number) {
    if (fromId === toId || amountCents === 0) return;
    const key = `${fromId}:${toId}`;
    pairBalances.set(key, (pairBalances.get(key) ?? 0) + amountCents);
  }

  for (const share of shares) {
    const expense = expensesById.get(share.expense_id);
    if (expense) {
      addPairBalance(share.person_id, expense.paid_by, Math.round(Number(share.share_amount) * 100));
    }
  }

  for (const settlement of settlements) {
    addPairBalance(
      settlement.from_person_id,
      settlement.to_person_id,
      -Math.round(Number(settlement.amount) * 100),
    );
  }

  const personById = new Map(people.map((person) => [person.id, person]));
  const debts: Debt[] = [];
  for (const [key, balance] of pairBalances) {
    if (balance < 1) continue;
    const [fromId, toId] = key.split(":");
    const from = personById.get(fromId);
    const to = personById.get(toId);
    if (from && to) debts.push({ from, to, amount: balance });
  }

  return debts.sort((a, b) => b.amount - a.amount);
}

function calculateOffsetDebts(person: Person | undefined, debts: Debt[]) {
  if (!person) return [];
  const counterpartIds = new Set(
    debts
      .filter((debt) => debt.from.id === person.id || debt.to.id === person.id)
      .map((debt) => debt.from.id === person.id ? debt.to.id : debt.from.id),
  );

  return [...counterpartIds].flatMap((counterpartId) => {
    const owes = debts.find((debt) => debt.from.id === person.id && debt.to.id === counterpartId)?.amount ?? 0;
    const owed = debts.find((debt) => debt.from.id === counterpartId && debt.to.id === person.id)?.amount ?? 0;
    const difference = owes - owed;
    const counterpart = debts.find((debt) => debt.from.id === counterpartId || debt.to.id === counterpartId);
    const otherPerson = counterpart?.from.id === counterpartId ? counterpart.from : counterpart?.to;

    if (!difference || !otherPerson) return [];
    return difference > 0
      ? [{ from: person, to: otherPerson, amount: difference }]
      : [{ from: otherPerson, to: person, amount: Math.abs(difference) }];
  }).sort((a, b) => b.amount - a.amount);
}

export default function Splitwise({ traveler }: { traveler: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [personEditorOpen, setPersonEditorOpen] = useState(false);
  const [expenseEditorOpen, setExpenseEditorOpen] = useState(false);
  const [settlementEditorOpen, setSettlementEditorOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [personName, setPersonName] = useState("");
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    name: "",
    amount: "",
    paid_by: "",
    expense_date: localDateValue(),
    note: "",
    split_mode: "equally",
  });
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [settlementDate, setSettlementDate] = useState(localDateValue());
  const [settlementNote, setSettlementNote] = useState("");
  const [settlementProof, setSettlementProof] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const [
        { data: peopleData, error: peopleError },
        { data: expenseData, error: expenseError },
        { data: shareData, error: shareError },
        { data: settlementData, error: settlementError },
      ] = await Promise.all([
        supabase.from("splitwise_people").select("id, name, created_at").order("created_at").order("name"),
        supabase.from("splitwise_expenses").select("id, name, amount, paid_by, expense_date, note, split_mode, created_at").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("splitwise_shares").select("expense_id, person_id, share_amount"),
        supabase.from("splitwise_settlements").select("id, from_person_id, to_person_id, amount, settlement_date, note, proof_path, created_at").order("settlement_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);

      if (peopleError) throw peopleError;
      if (expenseError) throw expenseError;
      if (shareError) throw shareError;
      if (settlementError) throw settlementError;

      setPeople((peopleData ?? []) as Person[]);
      setExpenses((expenseData ?? []) as Expense[]);
      setShares((shareData ?? []) as Share[]);
      const settlementsWithProofs = await Promise.all(
        (settlementData ?? []).map(async (settlement) => {
          if (!settlement.proof_path) return { ...settlement, proof_url: null };
          const { data: signedUrl, error: proofError } = await supabase
            .storage
            .from("splitwise-payment-proofs")
            .createSignedUrl(settlement.proof_path, 60 * 60);
          if (proofError) throw proofError;
          return { ...settlement, proof_url: signedUrl.signedUrl };
        }),
      );
      setSettlements(settlementsWithProofs as Settlement[]);
      setLoadFailed(false);
      setErrorMessage(null);
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to load Splitwise data: ${message}`);
      setLoadFailed(true);
      setErrorMessage(`We couldn’t load shared expenses: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load persisted trip participants, expenses, shares, and settlements.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const currentPerson = people.find((person) => person.name === traveler);
  const balances = useMemo(
    () => calculateBalances(people, expenses, shares, settlements),
    [people, expenses, shares, settlements],
  );
  const debts = useMemo(
    () => calculateDebts(people, expenses, shares, settlements),
    [people, expenses, shares, settlements],
  );
  const currentDebts = currentPerson
    ? debts.filter((debt) => debt.from.id === currentPerson.id || debt.to.id === currentPerson.id)
    : [];
  const debtsYouOwe = currentDebts.filter((debt) => debt.from.id === currentPerson?.id);
  const debtsOwedToYou = currentDebts.filter((debt) => debt.to.id === currentPerson?.id);
  const offsetDebts = calculateOffsetDebts(currentPerson, debts);
  const groupSpendCents = expenses.reduce((total, expense) => total + Math.round(Number(expense.amount) * 100), 0);
  const currentBalanceCents = currentPerson ? balances.get(currentPerson.id) ?? 0 : 0;
  const settledPeople = [...balances.values()].filter((balance) => Math.abs(balance) < 1).length;

  function openNewPerson() {
    setEditingPerson(null);
    setPersonName("");
    setPersonEditorOpen(true);
  }

  function openEditPerson(person: Person) {
    setEditingPerson(person);
    setPersonName(person.name);
    setPersonEditorOpen(true);
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const result = editingPerson
        ? await supabase.from("splitwise_people").update({ name: personName.trim() }).eq("id", editingPerson.id)
        : await supabase.from("splitwise_people").insert({ name: personName.trim() });
      if (result.error) throw result.error;
      setPersonEditorOpen(false);
      await loadData();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to save Splitwise participant: ${message}`);
      setErrorMessage(`We couldn’t save this person: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePerson(person: Person) {
    if (!window.confirm(`Remove ${person.name} from the trip? People with expense or settlement history cannot be removed.`)) return;
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("splitwise_people").delete().eq("id", person.id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to remove Splitwise participant: ${message}`);
      setErrorMessage(`We couldn’t remove ${person.name}. If this person is on an expense or settlement, keep them in the trip. ${message}`);
    }
  }

  function openNewExpense() {
    setEditingExpense(null);
    setCustomShares({});
    setExpenseDraft({
      name: "",
      amount: "",
      paid_by: people.find((person) => person.name === traveler)?.id ?? people[0]?.id ?? "",
      expense_date: localDateValue(),
      note: "",
      split_mode: "equally",
    });
    setExpenseEditorOpen(true);
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense);
    setExpenseDraft({
      name: expense.name,
      amount: String(expense.amount),
      paid_by: expense.paid_by,
      expense_date: expense.expense_date.slice(0, 10),
      note: expense.note,
      split_mode: expense.split_mode,
    });
    setCustomShares(Object.fromEntries(
      shares
        .filter((share) => share.expense_id === expense.id && share.person_id !== expense.paid_by)
        .map((share) => [share.person_id, Number(share.share_amount).toFixed(2)]),
    ));
    setExpenseEditorOpen(true);
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const amountCents = Math.round(Number(expenseDraft.amount) * 100);
    let sharesPayload: { person_id: string; share_amount: number }[] = [];

    if (expenseDraft.split_mode === "custom") {
      const otherShares = people
        .filter((person) => person.id !== expenseDraft.paid_by)
        .map((person) => ({
          person_id: person.id,
          cents: moneyInputCents(customShares[person.id] ?? ""),
        }));

      if (otherShares.some((share) => share.cents === null || share.cents < 0)) {
        setErrorMessage("Enter a valid amount with no more than two decimal places for each other participant.");
        return;
      }
      const allocatedCents = otherShares.reduce((sum, share) => sum + (share.cents ?? 0), 0);
      if (allocatedCents > amountCents) {
        setErrorMessage("Custom shares cannot add up to more than the total expense.");
        return;
      }

      sharesPayload = [
        ...otherShares.map((share) => ({ person_id: share.person_id, share_amount: (share.cents ?? 0) / 100 })),
        { person_id: expenseDraft.paid_by, share_amount: (amountCents - allocatedCents) / 100 },
      ];
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("save_splitwise_expense", {
        p_expense_id: editingExpense?.id ?? null,
        p_name: expenseDraft.name.trim(),
        p_amount: Number(expenseDraft.amount),
        p_paid_by: expenseDraft.paid_by,
        p_expense_date: expenseDraft.expense_date,
        p_note: expenseDraft.note.trim(),
        p_split_mode: expenseDraft.split_mode,
        p_custom_shares: sharesPayload,
      });
      if (error) throw error;
      setExpenseEditorOpen(false);
      await loadData();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to save Splitwise expense: ${message}`);
      setErrorMessage(`We couldn’t save this transaction: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete “${expense.name}” and its split?`)) return;
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("splitwise_expenses").delete().eq("id", expense.id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to delete Splitwise expense: ${message}`);
      setErrorMessage(`We couldn’t delete this transaction: ${message}`);
    }
  }

  function openSettlement(debt: Debt) {
    setSettlingDebt(debt);
    setSettlementDate(localDateValue());
    setSettlementNote("");
    setSettlementProof(null);
    setSettlementEditorOpen(true);
  }

  async function saveSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settlingDebt || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      let proofPath: string | null = null;
      if (settlementProof) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(settlementProof.type)) {
          throw new Error("Payment proof must be a JPG, PNG, WEBP, or PDF file.");
        }
        if (settlementProof.size > 10 * 1024 * 1024) {
          throw new Error("Payment proof must be 10 MB or smaller.");
        }

        const safeFileName = settlementProof.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        proofPath = `${settlingDebt.from.id}/${crypto.randomUUID()}-${safeFileName}`;
        const { error: uploadError } = await supabase
          .storage
          .from("splitwise-payment-proofs")
          .upload(proofPath, settlementProof, {
            contentType: settlementProof.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("splitwise_settlements").insert({
        from_person_id: settlingDebt.from.id,
        to_person_id: settlingDebt.to.id,
        amount: settlingDebt.amount / 100,
        settlement_date: settlementDate,
        note: settlementNote.trim(),
        proof_path: proofPath,
      });
      if (error) {
        if (proofPath) {
          const { error: cleanupError } = await supabase.storage.from("splitwise-payment-proofs").remove([proofPath]);
          if (cleanupError) {
            console.error(`Unable to remove unlinked payment proof: ${errorText(cleanupError)}`);
          }
        }
        throw error;
      }
      setSettlementEditorOpen(false);
      setSettlingDebt(null);
      setSettlementProof(null);
      await loadData();
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to record Splitwise settlement: ${message}`);
      setErrorMessage(`We couldn’t record this settlement: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSettlement(settlement: Settlement) {
    if (!window.confirm(`Delete this ${formatRM(Number(settlement.amount))} settlement record?`)) return;
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("splitwise_settlements").delete().eq("id", settlement.id);
      if (error) throw error;
      let proofCleanupMessage: string | null = null;
      if (settlement.proof_path) {
        const { error: proofError } = await supabase.storage.from("splitwise-payment-proofs").remove([settlement.proof_path]);
        if (proofError) {
          console.error(`Unable to delete Splitwise payment proof: ${errorText(proofError)}`);
          proofCleanupMessage = `The settlement was deleted, but its payment proof could not be removed: ${errorText(proofError)}`;
        }
      }
      await loadData();
      if (proofCleanupMessage) setErrorMessage(proofCleanupMessage);
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to delete Splitwise settlement: ${message}`);
      setErrorMessage(`We couldn’t delete this settlement: ${message}`);
    }
  }

  const closeEditors = () => {
    if (isSaving) return;
    setPersonEditorOpen(false);
    setExpenseEditorOpen(false);
    setSettlementEditorOpen(false);
  };

  return (
    <main className="itinerary-page splitwise-page">
      <header className="itinerary-topbar">
        <Link className="itinerary-brand" href="/" aria-label="Back to traveler selection">
          <span className="itinerary-brand-mark">✳</span>
          <strong>Trip WanderSync</strong>
        </Link>
        <nav className="itinerary-nav" aria-label="Trip sections">
          <Link href={`/itinerary?traveler=${encodeURIComponent(traveler)}`}>Itinerary</Link>
          <Link href={`/budget?traveler=${encodeURIComponent(traveler)}`}>Budget</Link>
          <Link href={`/roles?traveler=${encodeURIComponent(traveler)}`}>Roles</Link>
          <Link href={`/checklists?traveler=${encodeURIComponent(traveler)}`}>Checklists</Link>
          <span className="nav-active">Splitwise</span>
          <Link href={`/booking-vault?traveler=${encodeURIComponent(traveler)}`}>Booking Vault</Link>
          <Link href={`/transit?traveler=${encodeURIComponent(traveler)}`}>Transit</Link>
        </nav>
        <Link className="active-traveler" href="/" title="Switch traveler">
          <span className="mini-avatar">{traveler.split(" ")[0].slice(0, 2)}</span>
          {traveler.split(" ")[0]}
          <span className="switch-label">Switch</span>
        </Link>
      </header>

      <div className="splitwise-shell">
        <div className="splitwise-heading">
          <div>
            <span className="itinerary-eyebrow">SHARED TRIP LEDGER</span>
            <h1>Trip Expense Balances &amp; Settlements</h1>
            <p>Track shared trip spending and see what each traveler owes or is owed.</p>
          </div>
          <div className="splitwise-heading-actions">
            <button className="splitwise-secondary-button" type="button" onClick={openNewPerson} disabled={isLoading || loadFailed}>
              <Icon name="people" size={17} /> Add person
            </button>
            <button className="splitwise-primary-button" type="button" onClick={openNewExpense} disabled={people.length === 0 || isLoading || loadFailed}>
              <Icon name="plus" size={17} /> Add transaction
            </button>
          </div>
        </div>

        {errorMessage && !loadFailed && (
          <div className="splitwise-alert" role="alert">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => { setIsLoading(true); void loadData(); }}>Retry</button>
          </div>
        )}

        {isLoading ? (
          <div className="splitwise-loading" role="status">Loading your shared ledger…</div>
        ) : loadFailed ? (
          <div className="splitwise-setup-hint">
            <Icon name="wallet" size={23} />
            <div>
              <strong>Finish connecting the shared ledger</strong>
              <p>Run <code>20260929000009_splitwise.sql</code>, <code>20260929000010_splitwise_custom_shares.sql</code>, and <code>20260929000011_splitwise_payment_proofs.sql</code> in the Supabase SQL Editor, then retry.</p>
              {errorMessage && <small>{errorMessage.replace("We couldn’t load shared expenses: ", "")}</small>}
            </div>
            <button type="button" onClick={() => { setIsLoading(true); void loadData(); }}>Retry</button>
          </div>
        ) : (
          <>
            <section className="splitwise-people" aria-label="Trip participants">
              {people.map((person) => (
                <article className="splitwise-person-card" key={person.id}>
                  <div className="splitwise-avatar">{person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
                  <div className="splitwise-person-copy">
                    <strong>{person.name}</strong>
                    <span>Trip participant</span>
                  </div>
                  <div className="splitwise-person-actions">
                    <button type="button" aria-label={`Edit ${person.name}`} onClick={() => openEditPerson(person)}><Icon name="edit" size={17} /></button>
                    <button type="button" aria-label={`Remove ${person.name}`} onClick={() => void deletePerson(person)}><Icon name="trash" size={17} /></button>
                  </div>
                </article>
              ))}
              {people.length === 0 && (
                <div className="splitwise-empty-people">
                  No participants yet. Add the people sharing this trip to get started.
                </div>
              )}
            </section>

            <section className="splitwise-summary" aria-label="Shared expense summary">
              <article className="splitwise-summary-card">
                <span>Total Shared Group Spending</span>
                <strong>{formatRM(groupSpendCents / 100)}</strong>
                <small>Across all recorded transactions</small>
              </article>
              <article className="splitwise-summary-card">
                <span>{traveler.split(" ")[0]} current balance</span>
                <strong>{formatRM(Math.abs(currentBalanceCents) / 100)}</strong>
                <small>
                  {currentBalanceCents < 0 ? "You are owed" : currentBalanceCents > 0 ? "You owe" : "All settled"}
                </small>
              </article>
              <article className="splitwise-summary-card">
                <span>Settlement status</span>
                <strong className="splitwise-summary-status">{settledPeople} of {people.length} settled</strong>
                <small>{settlements.length} recorded {settlements.length === 1 ? "payment" : "payments"}</small>
              </article>
            </section>

            {currentBalanceCents !== 0 && (
              <div className={`splitwise-balance-banner ${currentBalanceCents < 0 ? "is-credit" : "is-debt"}`}>
                {currentBalanceCents < 0
                  ? `You are owed ${formatRM(Math.abs(currentBalanceCents) / 100)}`
                  : `You owe ${formatRM(currentBalanceCents / 100)}`}
              </div>
            )}

            <section className="splitwise-section">
              <div className="splitwise-section-heading">
                <h2>{traveler.split(" ")[0]}’s balances &amp; settlements</h2>
                <span>{currentDebts.length ? `${currentDebts.length} balance${currentDebts.length === 1 ? "" : "s"} to settle` : "All settled"}</span>
              </div>
              <div className="splitwise-balance-columns">
                <div className="splitwise-balance-column">
                  <div className="splitwise-balance-column-heading">
                    <strong>You owe</strong>
                    <span>Pay these travelers</span>
                  </div>
                  {debtsYouOwe.length === 0 ? (
                    <div className="splitwise-empty splitwise-column-empty">You don’t owe anyone right now.</div>
                  ) : (
                    <div className="splitwise-debt-list">
                      {debtsYouOwe.map((debt) => (
                    <article className="splitwise-debt-card" key={`${debt.from.id}-${debt.to.id}`}>
                      <div className="splitwise-debt-avatars">
                        <span>{debt.from.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                        <Icon name="arrow" size={16} />
                        <span>{debt.to.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                      </div>
                      <strong>You owe <b>{debt.to.name}</b></strong>
                      <span className="splitwise-debt-amount">{formatRM(debt.amount / 100)}</span>
                    </article>
                      ))}
                    </div>
                  )}
                </div>
                <div className="splitwise-balance-column">
                  <div className="splitwise-balance-column-heading">
                    <strong>Owes you</strong>
                    <span>Collect from these travelers</span>
                  </div>
                  {debtsOwedToYou.length === 0 ? (
                    <div className="splitwise-empty splitwise-column-empty">No one owes you right now.</div>
                  ) : (
                    <div className="splitwise-debt-list">
                      {debtsOwedToYou.map((debt) => (
                        <article className="splitwise-debt-card" key={`${debt.from.id}-${debt.to.id}`}>
                          <div className="splitwise-debt-avatars">
                            <span>{debt.from.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                            <Icon name="arrow" size={16} />
                            <span>{debt.to.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                          </div>
                          <strong><b>{debt.from.name}</b> owes you</strong>
                          <span className="splitwise-debt-amount">{formatRM(debt.amount / 100)}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="splitwise-offset-balances">
                  <div className="splitwise-balance-column-heading">
                    <strong>After offset</strong>
                    <span>Final amount between you and each traveler after deducting opposite-way balances.</span>
                  </div>
                  {offsetDebts.length === 0 ? (
                    <div className="splitwise-empty splitwise-column-empty">All balances with you are settled after offset.</div>
                  ) : (
                    <div className="splitwise-debt-list">
                      {offsetDebts.map((debt) => (
                        <article className="splitwise-debt-card" key={`${debt.from.id}-${debt.to.id}`}>
                          <div className="splitwise-debt-avatars">
                            <span>{debt.from.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                            <Icon name="arrow" size={16} />
                            <span>{debt.to.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                          </div>
                          <strong>
                            {debt.from.id === currentPerson?.id
                              ? <>You owe <b>{debt.to.name}</b></>
                              : <><b>{debt.from.name}</b> owes you</>}
                          </strong>
                          <span className="splitwise-debt-amount">{formatRM(debt.amount / 100)}</span>
                          <button type="button" onClick={() => openSettlement(debt)}>Record payment</button>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
            </section>

            <section className="splitwise-section">
              <div className="splitwise-section-heading">
                <h2>Recent Group Transactions</h2>
                <span>{expenses.length} transaction{expenses.length === 1 ? "" : "s"}</span>
              </div>
              {expenses.length === 0 ? (
                <div className="splitwise-empty">Your shared transactions will appear here once added.</div>
              ) : (
                <div className="splitwise-transaction-list">
                  {expenses.map((expense) => {
                    const payer = personById.get(expense.paid_by);
                    return (
                      <article className="splitwise-transaction" key={expense.id}>
                        <div className="splitwise-transaction-icon"><Icon name="wallet" size={19} /></div>
                        <div className="splitwise-transaction-copy">
                          <strong>{expense.name}</strong>
                          <span>{formatDate(expense.expense_date)} · Paid by {payer?.name ?? "Unknown participant"}</span>
                          <small>{expense.split_mode === "custom" ? "Custom split" : "Split equally"} · Shared between {shares.filter((share) => share.expense_id === expense.id).length} people{expense.note && expense.note !== "Split equally" ? ` · ${expense.note}` : ""}</small>
                        </div>
                        <strong className="splitwise-transaction-amount">{formatRM(Number(expense.amount))}</strong>
                        <div className="splitwise-transaction-actions">
                          <button type="button" aria-label={`Edit ${expense.name}`} onClick={() => openEditExpense(expense)}><Icon name="edit" size={16} /></button>
                          <button type="button" aria-label={`Delete ${expense.name}`} onClick={() => void deleteExpense(expense)}><Icon name="trash" size={16} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {settlements.length > 0 && (
              <section className="splitwise-section">
                <div className="splitwise-section-heading">
                  <h2>Recorded Settlements</h2>
                  <span>Shared payment history</span>
                </div>
                <div className="splitwise-transaction-list">
                  {settlements.map((settlement) => (
                    <article className="splitwise-transaction settlement-row" key={settlement.id}>
                      <div className="splitwise-transaction-icon settlement-icon"><Icon name="check" size={19} /></div>
                      <div className="splitwise-transaction-copy">
                        <strong>{personById.get(settlement.from_person_id)?.name ?? "Unknown"} paid {personById.get(settlement.to_person_id)?.name ?? "Unknown"}</strong>
                        <span>{formatDate(settlement.settlement_date)} · Settlement recorded</span>
                        {settlement.note && <small>{settlement.note}</small>}
                        {settlement.proof_url && (
                          <a className="splitwise-proof-link" href={settlement.proof_url} target="_blank" rel="noreferrer">
                            View payment proof
                          </a>
                        )}
                      </div>
                      <strong className="splitwise-transaction-amount">{formatRM(Number(settlement.amount))}</strong>
                      <div className="splitwise-transaction-actions">
                        <button type="button" aria-label="Delete settlement" onClick={() => void deleteSettlement(settlement)}><Icon name="trash" size={16} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {(personEditorOpen || expenseEditorOpen || settlementEditorOpen) && (
        <div className="splitwise-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeEditors();
        }}>
          {personEditorOpen && (
            <section className="splitwise-editor" role="dialog" aria-modal="true" aria-labelledby="splitwise-person-title">
              <div className="splitwise-editor-header">
                <div><span className="itinerary-eyebrow">TRIP PARTICIPANTS</span><h2 id="splitwise-person-title">{editingPerson ? "Edit person" : "Add person"}</h2></div>
                <button type="button" aria-label="Close form" onClick={closeEditors}><Icon name="close" size={21} /></button>
              </div>
              <form className="splitwise-form" onSubmit={savePerson}>
                <label><span>Person’s name <b>*</b></span>
                  <input autoFocus required maxLength={100} value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="e.g. Iffah Afiqah" />
                </label>
                <div className="splitwise-editor-footer">
                  <span>Participants and transactions are shared with the trip.</span>
                  <div>
                    <button type="button" className="splitwise-cancel-button" onClick={closeEditors} disabled={isSaving}>Cancel</button>
                    <button type="submit" className="splitwise-primary-button" disabled={isSaving}>{isSaving ? "Saving…" : editingPerson ? "Save changes" : "Add person"}</button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {expenseEditorOpen && (
            <section className="splitwise-editor" role="dialog" aria-modal="true" aria-labelledby="splitwise-expense-title">
              <div className="splitwise-editor-header">
                <div><span className="itinerary-eyebrow">TRIP EDITOR</span><h2 id="splitwise-expense-title">{editingExpense ? "Edit transaction" : "Add transaction"}</h2></div>
                <button type="button" aria-label="Close form" onClick={closeEditors}><Icon name="close" size={21} /></button>
              </div>
              <form className="splitwise-form" onSubmit={saveExpense}>
                <label><span>Expense name <b>*</b></span>
                  <input autoFocus required maxLength={120} value={expenseDraft.name} onChange={(event) => setExpenseDraft({ ...expenseDraft, name: event.target.value })} placeholder="e.g. Sunway Lagoon passes" />
                </label>
                <label><span>Amount (RM) <b>*</b></span>
                  <input type="number" required min="0.01" max="9999999999.99" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} placeholder="0.00" />
                </label>
                <label><span>Paid by <b>*</b></span>
                  <select required value={expenseDraft.paid_by} onChange={(event) => setExpenseDraft({ ...expenseDraft, paid_by: event.target.value })}>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label><span>Date <b>*</b></span>
                  <input type="date" required value={expenseDraft.expense_date} onChange={(event) => setExpenseDraft({ ...expenseDraft, expense_date: event.target.value })} />
                </label>
                <fieldset className="splitwise-split-mode">
                  <legend>How should this be split?</legend>
                  <label className={expenseDraft.split_mode === "equally" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="split-mode"
                      value="equally"
                      checked={expenseDraft.split_mode === "equally"}
                      onChange={() => setExpenseDraft({ ...expenseDraft, split_mode: "equally" })}
                    />
                    <span><strong>Equally</strong><small>Divide the total fairly between everyone.</small></span>
                  </label>
                  <label className={expenseDraft.split_mode === "custom" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="split-mode"
                      value="custom"
                      checked={expenseDraft.split_mode === "custom"}
                      onChange={() => setExpenseDraft({ ...expenseDraft, split_mode: "custom" })}
                    />
                    <span><strong>Custom</strong><small>Enter what each other participant owes.</small></span>
                  </label>
                </fieldset>
                {expenseDraft.split_mode === "custom" && (
                  <div className="splitwise-custom-shares">
                    <div className="splitwise-custom-heading">
                      <strong>Custom shares</strong>
                      <span>Enter the amount each person other than the payer owes.</span>
                    </div>
                    {people.filter((person) => person.id !== expenseDraft.paid_by).map((person) => (
                      <label key={person.id}>
                        <span>{person.name} owes (RM)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={customShares[person.id] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (/^\d*(?:\.\d{0,2})?$/.test(value)) {
                              setCustomShares((current) => ({ ...current, [person.id]: value }));
                            }
                          }}
                          placeholder="0.00"
                        />
                      </label>
                    ))}
                    <div className="splitwise-payer-share">
                      <span>{people.find((person) => person.id === expenseDraft.paid_by)?.name ?? "Payer"}’s share (remaining)</span>
                      <strong>
                        {formatRM(Math.max(
                          0,
                          (Math.round(Number(expenseDraft.amount || 0) * 100) -
                            people
                              .filter((person) => person.id !== expenseDraft.paid_by)
                              .reduce((sum, person) => sum + Math.round(Number(customShares[person.id] || "0") * 100), 0)) / 100,
                        ))}
                      </strong>
                    </div>
                    <small>Any remaining amount is assigned to the payer. Other participants’ shares cannot exceed the total.</small>
                  </div>
                )}
                <label><span>Split / payment note</span>
                  <input maxLength={250} value={expenseDraft.note} onChange={(event) => setExpenseDraft({ ...expenseDraft, note: event.target.value })} placeholder="Optional note" />
                </label>
                <div className="splitwise-split-note"><Icon name="people" size={18} /><span>{expenseDraft.split_mode === "equally" ? `Split equally between ${people.length} ${people.length === 1 ? "participant" : "participants"}.` : "Each participant’s share is stored in the shared ledger."} Shares are saved with this transaction.</span></div>
                {errorMessage && <div className="splitwise-inline-error" role="alert">{errorMessage}</div>}
                <div className="splitwise-editor-footer">
                  <span>Changes are shared with your trip group.</span>
                  <div>
                    <button type="button" className="splitwise-cancel-button" onClick={closeEditors} disabled={isSaving}>Cancel</button>
                    <button type="submit" className="splitwise-primary-button" disabled={isSaving || people.length === 0}>{isSaving ? "Saving…" : editingExpense ? "Save changes" : "Save transaction"}</button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {settlementEditorOpen && settlingDebt && (
            <section className="splitwise-editor" role="dialog" aria-modal="true" aria-labelledby="splitwise-settlement-title">
              <div className="splitwise-editor-header">
                <div><span className="itinerary-eyebrow">TRIP EDITOR</span><h2 id="splitwise-settlement-title">Record settlement</h2></div>
                <button type="button" aria-label="Close form" onClick={closeEditors}><Icon name="close" size={21} /></button>
              </div>
              <form className="splitwise-form" onSubmit={saveSettlement}>
                <div className="splitwise-settlement-summary">
                  <strong>{settlingDebt.from.name}</strong><Icon name="arrow" size={18} /><strong>{settlingDebt.to.name}</strong>
                  <span>{formatRM(settlingDebt.amount / 100)}</span>
                </div>
                <label><span>Date <b>*</b></span>
                  <input type="date" required value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} />
                </label>
                <label><span>Payment note</span>
                  <input maxLength={250} value={settlementNote} onChange={(event) => setSettlementNote(event.target.value)} placeholder="e.g. Bank transfer" />
                </label>
                <label>
                  <span>Payment proof <small>(optional)</small></span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => setSettlementProof(event.target.files?.[0] ?? null)}
                  />
                  <small className="splitwise-file-help">
                    Upload a JPG, PNG, WEBP, or PDF, up to 10 MB.
                    {settlementProof ? ` Selected: ${settlementProof.name}` : ""}
                  </small>
                </label>
                <div className="splitwise-editor-footer">
                  <span>Recording payment updates everyone’s balance.</span>
                  <div>
                    <button type="button" className="splitwise-cancel-button" onClick={closeEditors} disabled={isSaving}>Cancel</button>
                    <button type="submit" className="splitwise-primary-button" disabled={isSaving}>{isSaving ? "Saving…" : "Confirm payment"}</button>
                  </div>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
