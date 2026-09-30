"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type BookingRecord = {
  id: string;
  record_key: "accommodation" | "sunway_lagoon";
  title: string;
  booking_reference: string;
  keybox_pin: string;
  parking_lot: string;
  security_deposit: number | null;
  ticket_quantity: number | null;
  locker_voucher: string;
  locker_price: number | null;
};

type BookingFile = {
  id: string;
  record_id: string;
  file_name: string;
  file_path: string;
  content_type: string;
  file_size: number;
  uploaded_at: string;
  signed_url: string;
};

type BookingDraft = Omit<BookingRecord, "id" | "record_key">;

const fieldLabels: Record<string, string> = {
  booking_reference: "Booking reference / reservation code",
  keybox_pin: "Keybox PIN code",
  parking_lot: "Assigned car park lot",
  security_deposit: "Security deposit (RM)",
  ticket_quantity: "Number of tickets",
  locker_voucher: "Locker rental voucher",
  locker_price: "Locker rental price (RM)",
};

const icons: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></>,
  ticket: <><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a3 3 0 0 0 0-6Z" /><path d="M13 5v2m0 3v2m0 3v2m0 3v1" /></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6m-11 5h6m-6 4h6" /></>,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
};

function Icon({ name, size = 18 }: { name: keyof typeof icons; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function describeError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const parts = [Reflect.get(error, "message"), Reflect.get(error, "details"), Reflect.get(error, "hint")]
      .filter((part): part is string => typeof part === "string" && Boolean(part));
    if (parts.length) return parts.join(" ");
  }
  return "An unknown database error occurred.";
}

function toDraft(record: BookingRecord): BookingDraft {
  return {
    title: record.title,
    booking_reference: record.booking_reference,
    keybox_pin: record.keybox_pin,
    parking_lot: record.parking_lot,
    security_deposit: record.security_deposit,
    ticket_quantity: record.ticket_quantity,
    locker_voucher: record.locker_voucher,
    locker_price: record.locker_price,
  };
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BookingVault({ traveler }: { traveler: string }) {
  const [records, setRecords] = useState<BookingRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, BookingDraft>>({});
  const [files, setFiles] = useState<BookingFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingRecord, setSavingRecord] = useState<string | null>(null);
  const [uploadingRecord, setUploadingRecord] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadVault = useCallback(async () => {
    try {
      const supabase = createClient();
      const [
        { data: recordData, error: recordError },
        { data: fileData, error: fileError },
      ] = await Promise.all([
        supabase
          .from("booking_vault_records")
          .select("id, record_key, title, booking_reference, keybox_pin, parking_lot, security_deposit, ticket_quantity, locker_voucher, locker_price")
          .order("record_key"),
        supabase
          .from("booking_vault_files")
          .select("id, record_id, file_name, file_path, content_type, file_size, uploaded_at")
          .order("uploaded_at", { ascending: false }),
      ]);
      if (recordError) throw recordError;
      if (fileError) throw fileError;

      const nextRecords = (recordData ?? []) as BookingRecord[];
      const nextFiles = await Promise.all((fileData ?? []).map(async (file) => {
        const { data, error } = await supabase.storage
          .from("booking-vault-files")
          .createSignedUrl(file.file_path, 60 * 60);
        if (error) throw error;
        return { ...file, signed_url: data.signedUrl } as BookingFile;
      }));

      setRecords(nextRecords);
      setDrafts(Object.fromEntries(nextRecords.map((record) => [record.id, toDraft(record)])));
      setFiles(nextFiles);
      setLoadFailed(false);
      setErrorMessage(null);
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to load booking vault: ${message}`);
      setLoadFailed(true);
      setErrorMessage(`We couldn’t load the Booking Vault: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load shared booking records and signed links to private attachments.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadVault();
  }, [loadVault]);

  function updateDraft(recordId: string, field: keyof BookingDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [recordId]: {
        ...current[recordId],
        [field]: field === "security_deposit" || field === "ticket_quantity" || field === "locker_price"
          ? value === "" ? null : Number(value)
          : value,
      },
    }));
    setSuccessMessage(null);
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>, record: BookingRecord) {
    event.preventDefault();
    if (savingRecord) return;
    setSavingRecord(record.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const draft = drafts[record.id];
      const supabase = createClient();
      const { error } = await supabase
        .from("booking_vault_records")
        .update({ ...draft, updated_at: new Date().toISOString() })
        .eq("id", record.id);
      if (error) throw error;
      await loadVault();
      setSuccessMessage(`${record.title} details saved.`);
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to save booking details: ${message}`);
      setErrorMessage(`We couldn’t save these details: ${message}`);
    } finally {
      setSavingRecord(null);
    }
  }

  async function uploadFiles(record: BookingRecord, selectedFiles: FileList | null) {
    if (!selectedFiles?.length || uploadingRecord) return;
    setUploadingRecord(record.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    const supabase = createClient();
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    try {
      for (const file of Array.from(selectedFiles)) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`${file.name}: use a PDF, JPG, PNG, WEBP, or HEIC file.`);
        }
        if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
          throw new Error(`${file.name}: file size must be between 1 byte and 20 MB.`);
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${record.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("booking-vault-files")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;

        const { error: metadataError } = await supabase.from("booking_vault_files").insert({
          record_id: record.id,
          file_name: file.name,
          file_path: path,
          content_type: file.type,
          file_size: file.size,
        });
        if (metadataError) {
          const { error: cleanupError } = await supabase.storage.from("booking-vault-files").remove([path]);
          if (cleanupError) console.error(`Unable to clean up uploaded booking file: ${describeError(cleanupError)}`);
          throw metadataError;
        }
      }
      await loadVault();
      setSuccessMessage("Booking attachment uploaded.");
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to upload booking attachment: ${message}`);
      setErrorMessage(`We couldn’t upload the attachment: ${message}`);
    } finally {
      setUploadingRecord(null);
    }
  }

  async function deleteFile(file: BookingFile) {
    if (!window.confirm(`Remove “${file.file_name}” from the Booking Vault?`)) return;
    setDeletingFile(file.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const { error: metadataError } = await supabase.from("booking_vault_files").delete().eq("id", file.id);
      if (metadataError) throw metadataError;
      const { error: storageError } = await supabase.storage.from("booking-vault-files").remove([file.file_path]);
      if (storageError) {
        console.error(`Unable to delete booking file from storage: ${describeError(storageError)}`);
        setErrorMessage(`The attachment record was removed, but its file could not be deleted: ${describeError(storageError)}`);
      }
      await loadVault();
    } catch (error) {
      const message = describeError(error);
      console.error(`Unable to delete booking attachment: ${message}`);
      setErrorMessage(`We couldn’t remove this attachment: ${message}`);
    } finally {
      setDeletingFile(null);
    }
  }

  const accommodation = records.find((record) => record.record_key === "accommodation");
  const sunway = records.find((record) => record.record_key === "sunway_lagoon");

  function renderField(record: BookingRecord, field: keyof BookingDraft, type: "text" | "number" = "text") {
    const value = drafts[record.id]?.[field];
    const numberField = type === "number";
    return (
      <label className="booking-field" key={field}>
        <span>{fieldLabels[field]}</span>
        <input
          type={type}
          min={numberField ? "0" : undefined}
          step={field === "ticket_quantity" ? "1" : numberField ? "0.01" : undefined}
          maxLength={numberField ? undefined : 200}
          value={value ?? ""}
          onChange={(event) => updateDraft(record.id, field, event.target.value)}
          placeholder={numberField ? "Not added yet" : "Add details"}
        />
      </label>
    );
  }

  function renderRecord(record: BookingRecord, icon: "home" | "ticket") {
    const recordFiles = files.filter((file) => file.record_id === record.id);
    const draft = drafts[record.id];

    return (
      <article className="booking-card" key={record.id}>
        <div className="booking-card-heading">
          <span className={`booking-card-icon ${icon}`}><Icon name={icon} size={22} /></span>
          <div>
            <span className="booking-card-kicker">{record.record_key === "accommodation" ? "ACCOMMODATION" : "ATTRACTION TICKETS"}</span>
            <h2>{record.title}</h2>
          </div>
        </div>

        <form className="booking-details-form" onSubmit={(event) => void saveRecord(event, record)}>
          {record.record_key === "accommodation" ? (
            <div className="booking-fields-grid">
              {renderField(record, "booking_reference")}
              {renderField(record, "keybox_pin")}
              {renderField(record, "parking_lot")}
              {renderField(record, "security_deposit", "number")}
            </div>
          ) : (
            <div className="booking-fields-grid">
              {renderField(record, "booking_reference")}
              {renderField(record, "ticket_quantity", "number")}
              {renderField(record, "locker_voucher")}
              {renderField(record, "locker_price", "number")}
            </div>
          )}
          <div className="booking-save-row">
            <span>Shared with all trip participants</span>
            <button type="submit" className="splitwise-primary-button" disabled={savingRecord === record.id}>
              <Icon name="save" size={16} /> {savingRecord === record.id ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>

        {record.record_key === "accommodation" ? (
          <div className="booking-schedule" aria-label="Accommodation schedule">
            <div className="booking-schedule-heading"><Icon name="clock" size={17} /><strong>Stay schedule</strong></div>
            <div className="booking-schedule-times">
              <div><span>DAY 1 · CHECK-IN</span><strong>3:30 PM</strong></div>
              <div><span>DAY 4 · CHECK-OUT</span><strong>11:30 AM</strong></div>
            </div>
          </div>
        ) : (
          <div className="booking-reminder" role="note">
            <Icon name="alert" size={18} />
            <span><strong>Entrance reminder:</strong> Bring your physical MyKad for ticket verification.</span>
          </div>
        )}

        <section className="booking-files">
          <div className="booking-files-heading">
            <div>
              <h3>Files &amp; vouchers</h3>
              <p>{record.record_key === "accommodation"
                ? "Booking confirmation PDF and host self check-in guide screenshots."
                : "Digital ticket QR codes, PDFs, and locker rental voucher."}</p>
            </div>
            <label className={`booking-upload-button ${uploadingRecord === record.id ? "is-uploading" : ""}`}>
              <Icon name="upload" size={16} />
              {uploadingRecord === record.id ? "Uploading…" : "Upload files"}
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                disabled={Boolean(uploadingRecord)}
                onChange={(event) => {
                  void uploadFiles(record, event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <div className="booking-attachment-list">
            {recordFiles.length === 0 ? (
              <div className="booking-files-empty"><Icon name="file" size={19} /><span>No files uploaded yet.</span></div>
            ) : recordFiles.map((file) => (
              <article className="booking-attachment" key={file.id}>
                <span className="booking-attachment-icon"><Icon name="file" size={18} /></span>
                <div className="booking-attachment-copy">
                  <a href={file.signed_url} target="_blank" rel="noreferrer">{file.file_name}</a>
                  <span>{fileSize(Number(file.file_size))}</span>
                </div>
                <a className="booking-attachment-open" href={file.signed_url} target="_blank" rel="noreferrer">Open</a>
                <button
                  type="button"
                  aria-label={`Remove ${file.file_name}`}
                  disabled={deletingFile === file.id}
                  onClick={() => void deleteFile(file)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </article>
            ))}
          </div>
          <small className="booking-upload-help">PDF or image files · up to 20 MB per file · stored privately</small>
        </section>
        {draft && <span className="booking-updated-note">Booking details are saved to the shared trip vault.</span>}
      </article>
    );
  }

  return (
    <main className="itinerary-page booking-vault-page">
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
          <Link href={`/splitwise?traveler=${encodeURIComponent(traveler)}`}>Splitwise</Link>
          <span className="nav-active">Booking Vault</span>
          <Link href={`/transit?traveler=${encodeURIComponent(traveler)}`}>Transit</Link>
        </nav>
        <Link className="active-traveler" href="/" title="Switch traveler">
          <span className="mini-avatar">{traveler.split(" ")[0].slice(0, 2)}</span>
          {traveler.split(" ")[0]}
          <span className="switch-label">Switch</span>
        </Link>
      </header>

      <div className="booking-vault-shell">
        <div className="booking-vault-heading">
          <div>
            <span className="itinerary-eyebrow">YOUR TRIP DOCUMENTS</span>
            <h1>Booking Vault</h1>
            <p>Keep booking details, tickets, and check-in documents together for the whole trip.</p>
          </div>
          <div className="booking-vault-secure"><Icon name="file" size={16} /> Private shared files</div>
        </div>

        {errorMessage && (
          <div className="splitwise-alert" role="alert">
            <span>{errorMessage}</span>
            {loadFailed && <button type="button" onClick={() => { setIsLoading(true); void loadVault(); }}>Retry</button>}
          </div>
        )}
        {successMessage && <div className="booking-success" role="status">{successMessage}</div>}

        {isLoading ? (
          <div className="splitwise-loading" role="status">Loading your booking vault…</div>
        ) : loadFailed ? (
          <div className="splitwise-setup-hint">
            <Icon name="file" size={22} />
            <div>
              <strong>Connect the Booking Vault to Supabase</strong>
              <p>Run <code>20260929000012_booking_vault.sql</code> in the Supabase SQL Editor, then retry.</p>
            </div>
            <button type="button" onClick={() => { setIsLoading(true); void loadVault(); }}>Retry</button>
          </div>
        ) : (
          <>
            <div className="booking-vault-note">
              <Icon name="alert" size={18} />
              <span>Store booking references and files here. Add private access codes only if everyone in the trip should be able to view them.</span>
            </div>
            <div className="booking-records">
              {accommodation && renderRecord(accommodation, "home")}
              {sunway && renderRecord(sunway, "ticket")}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
