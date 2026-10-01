"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import colonyPhoto from "../../Gambar/colony.jpg";
import foodPhoto from "../../Gambar/KAK SOM.webp";
import galleryPhoto from "../../Gambar/National_Art_Gallery_Malaysia.width-2480.jpg";
import stationPhoto from "../../Gambar/medan tuanku.jpg";
import { createClient } from "@/utils/supabase/client";

type Activity = {
  id: string;
  day_number: number;
  start_time: string;
  title: string;
  location: string;
  transport: string;
  travel_duration: string;
  activity_duration: string;
  tags: string[];
  notes: string | null;
  image_url: string | null;
  menu_file_path: string | null;
  is_favorite: boolean;
  created_by: string | null;
};

type ActivityDraft = Omit<Activity, "id" | "is_favorite" | "created_by">;

const days = [
  { number: 1, label: "White & Brown", dress: "White & Brown", date: "24 DEC", photo: galleryPhoto },
  { number: 2, label: "Free & Easy / Casual", dress: "Casual", date: "25 DEC", photo: stationPhoto },
  { number: 3, label: "Banana & Cherry", dress: "Banana & Cherry", date: "26 DEC", photo: foodPhoto },
  { number: 4, label: "Green & Black", dress: "Green & Black", date: "27 DEC", photo: colonyPhoto },
] as const;

const emptyDraft: ActivityDraft = {
  day_number: 1,
  start_time: "09:00",
  title: "",
  location: "",
  transport: "Driving",
  travel_duration: "",
  activity_duration: "",
  tags: [],
  notes: "",
  image_url: "",
  menu_file_path: null,
};

const menuBucket = "itinerary-cafe-menus";
const maxMenuFileSize = 50 * 1024 * 1024;
const allowedMenuMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const menuFileExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function Icon({
  name,
  size = 18,
}: {
  name: "calendar" | "pin" | "star" | "edit" | "trash" | "plus" | "close" | "clock" | "arrow";
  size?: number;
}) {
  const paths = {
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h2m4 0h2m-8 3h2" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    edit: <><path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.8 2.8 0 0 0-4-4L4.2 15.1 4 20Z" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
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
      {paths[name]}
    </svg>
  );
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${String(hour % 12 || 12).padStart(2, "0")}:${minutes} ${suffix}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const message = [
      Reflect.get(error, "message"),
      Reflect.get(error, "details"),
      Reflect.get(error, "hint"),
    ].filter((value): value is string => typeof value === "string" && Boolean(value));

    if (message.length > 0) {
      return message.join(" ");
    }
  }

  return "An unknown database error occurred.";
}

export default function Itinerary({ traveler }: { traveler: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft);
  const [tagsInput, setTagsInput] = useState("");
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [removeExistingMenu, setRemoveExistingMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const loadActivities = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("itinerary_activities")
        .select(
          "id, day_number, start_time, title, location, transport, travel_duration, activity_duration, tags, notes, image_url, menu_file_path, is_favorite, created_by",
        )
        .order("day_number", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setActivities((data ?? []) as Activity[]);
      setLoadFailed(false);
    } catch (error) {
      console.error("Unable to load trip activities:", error);
      setLoadFailed(true);
      setErrorMessage(
        "We couldn’t load the shared itinerary. Check the Supabase setup and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load the shared database state when this screen mounts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActivities();
  }, [loadActivities]);

  const visibleActivities = useMemo(
    () => activities.filter((activity) => activity.day_number === activeDay),
    [activities, activeDay],
  );

  const activeDayInfo = days.find((day) => day.number === activeDay) ?? days[0];
  const favoriteCount = activities.filter((activity) => activity.is_favorite).length;

  function openNewActivity() {
    setEditingActivity(null);
    setDraft({ ...emptyDraft, day_number: activeDay });
    setTagsInput("");
    setMenuFile(null);
    setRemoveExistingMenu(false);
    setIsEditorOpen(true);
  }

  function openEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setDraft({
      day_number: activity.day_number,
      start_time: activity.start_time.slice(0, 5),
      title: activity.title,
      location: activity.location,
      transport: activity.transport,
      travel_duration: activity.travel_duration,
      activity_duration: activity.activity_duration,
      tags: activity.tags,
      notes: activity.notes ?? "",
      image_url: activity.image_url ?? "",
      menu_file_path: activity.menu_file_path,
    });
    setTagsInput(activity.tags.join(", "));
    setMenuFile(null);
    setRemoveExistingMenu(false);
    setIsEditorOpen(true);
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    let uploadedMenuPath: string | null = null;
    try {
      const supabase = createClient();
      if (menuFile) {
        if (!allowedMenuMimeTypes.includes(menuFile.type)) {
          throw new Error("Choose a menu image or PDF file.");
        }
        if (menuFile.size === 0 || menuFile.size > maxMenuFileSize) {
          throw new Error("The menu file must be 50 MB or smaller.");
        }

        const extension = menuFileExtensions[menuFile.type];
        uploadedMenuPath = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(menuBucket)
          .upload(uploadedMenuPath, menuFile, { contentType: menuFile.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const previousMenuPath = editingActivity?.menu_file_path ?? null;
      const payload = {
        ...draft,
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: draft.notes?.trim() || null,
        image_url: draft.image_url?.trim() || null,
        menu_file_path: uploadedMenuPath
          ?? (removeExistingMenu ? null : previousMenuPath),
      };
      const result = editingActivity
        ? await supabase
            .from("itinerary_activities")
            .update(payload)
            .eq("id", editingActivity.id)
        : await supabase
            .from("itinerary_activities")
            .insert({ ...payload, created_by: traveler, is_favorite: false });

      if (result.error) throw result.error;

      uploadedMenuPath = null;
      if (previousMenuPath && previousMenuPath !== payload.menu_file_path) {
        const { error: removeError } = await supabase.storage
          .from(menuBucket)
          .remove([previousMenuPath]);
        if (removeError) {
          console.error("Unable to remove replaced cafe menu:", removeError);
          setErrorMessage("The activity was saved, but its previous menu file could not be removed.");
        }
      }

      setActiveDay(payload.day_number);
      setIsEditorOpen(false);
      await loadActivities();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`Unable to save trip activity: ${message}`);
      if (uploadedMenuPath) {
        const supabase = createClient();
        const { error: cleanupError } = await supabase.storage
          .from(menuBucket)
          .remove([uploadedMenuPath]);
        if (cleanupError) {
          console.error("Unable to clean up an unlinked cafe menu upload:", cleanupError);
        }
      }
      setErrorMessage(
        message === "Choose a menu image or PDF file." ||
          message === "The menu file must be 50 MB or smaller."
          ? message
          : message.includes("itinerary_activities_day_number_fkey") ||
          message.includes('table "trip_days"')
          ? "This itinerary day is missing from the database. Run the trip-days migration in Supabase, then try again."
          : `We couldn’t save this activity: ${message}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleFavorite(activity: Activity) {
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("itinerary_activities")
        .update({ is_favorite: !activity.is_favorite })
        .eq("id", activity.id);

      if (error) throw error;

      setActivities((current) =>
        current.map((item) =>
          item.id === activity.id
            ? { ...item, is_favorite: !item.is_favorite }
            : item,
        ),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`Unable to update activity favorite: ${message}`);
      setErrorMessage(`We couldn’t update that favorite: ${message}`);
    }
  }

  async function deleteActivity(activity: Activity) {
    if (!window.confirm(`Delete “${activity.title}” from the itinerary?`)) {
      return;
    }

    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("itinerary_activities")
        .delete()
        .eq("id", activity.id);

      if (error) throw error;
      if (activity.menu_file_path) {
        const { error: removeError } = await supabase.storage
          .from(menuBucket)
          .remove([activity.menu_file_path]);
        if (removeError) {
          console.error("Unable to remove cafe menu after deleting its activity:", removeError);
          setErrorMessage("The activity was deleted, but its menu file could not be removed.");
        }
      }
      setActivities((current) => current.filter((item) => item.id !== activity.id));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`Unable to delete trip activity: ${message}`);
      setErrorMessage(`We couldn’t delete that activity: ${message}`);
    }
  }

  return (
    <main className="itinerary-page">
      <header className="itinerary-topbar">
        <Link className="itinerary-brand" href="/" aria-label="Back to traveler selection">
          <span className="itinerary-brand-mark">✳</span>
          <strong>Trip WanderSync</strong>
        </Link>
        <nav className="itinerary-nav" aria-label="Trip sections">
          <span className="nav-active">Itinerary</span>
          <Link href={`/budget?traveler=${encodeURIComponent(traveler)}`}>Budget</Link>
          <Link href={`/roles?traveler=${encodeURIComponent(traveler)}`}>Roles</Link>
          <Link href={`/checklists?traveler=${encodeURIComponent(traveler)}`}>Checklists</Link>
          <Link href={`/splitwise?traveler=${encodeURIComponent(traveler)}`}>Splitwise</Link>
          <Link href={`/booking-vault?traveler=${encodeURIComponent(traveler)}`}>Booking Vault</Link>
          <Link href={`/transit?traveler=${encodeURIComponent(traveler)}`}>Transit</Link>
        </nav>
        <Link className="active-traveler" href="/" title="Switch traveler">
          <span className="mini-avatar">{traveler.slice(0, 1)}</span>
          {traveler.split(" ")[0]}
          <span className="switch-label">Switch</span>
        </Link>
      </header>

      <div className="itinerary-shell">
        <div className="itinerary-heading">
          <div>
            <span className="itinerary-eyebrow">24–27 DECEMBER · SUNWAY &amp; KUALA LUMPUR</span>
            <h1>The trip timeline</h1>
            <p>A relaxed route through Sunway and KL, with enough breathing room for spontaneous detours.</p>
          </div>
          <button className="add-activity-button" type="button" onClick={openNewActivity}>
            <Icon name="plus" size={17} />
            Add activity
          </button>
        </div>

        <section className="route-summary" aria-label="Trip summary">
          <div>
            <span>SELECTED TRAVELER</span>
            <strong>{traveler}</strong>
          </div>
          <div className="summary-counts">
            <span>ROUTE SUMMARY</span>
            <strong>{activities.length} activities <i /> {favoriteCount} favourites</strong>
          </div>
        </section>

        <div className="day-tabs" role="tablist" aria-label="Itinerary days">
          {days.map((day) => (
            <button
              className={`day-tab${activeDay === day.number ? " day-tab-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeDay === day.number}
              key={day.number}
              onClick={() => setActiveDay(day.number)}
            >
              <span>Day {day.number}</span>
              <span className="tab-separator">·</span>
              {day.label}
            </button>
          ))}
        </div>

        <div className="dress-code-row">
          <span>Dress code</span>
          <strong>{activeDayInfo.dress}</strong>
          <span className="day-date">{activeDayInfo.date}</span>
        </div>

        {errorMessage && (
          <div className="itinerary-alert" role="alert">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setErrorMessage(null);
                void loadActivities();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="activity-loading" role="status">Loading your shared itinerary…</div>
        ) : loadFailed ? (
          <div className="activity-loading">The itinerary is unavailable until the Supabase setup is complete.</div>
        ) : visibleActivities.length === 0 ? (
          <div className="empty-day">
            <div className="empty-day-image">
              <Image src={activeDayInfo.photo} alt="" fill sizes="100px" />
            </div>
            <span className="section-kicker">A DAY FULL OF POSSIBILITIES</span>
            <h2>Nothing planned for Day {activeDay} just yet</h2>
            <p>Add the first stop and make this day yours.</p>
            <button className="empty-add-button" type="button" onClick={openNewActivity}>
              <Icon name="plus" size={16} /> Add the first activity
            </button>
          </div>
        ) : (
          <div className="activity-timeline">
            {visibleActivities.map((activity) => {
              const expanded = expandedIds.includes(activity.id);
              const image = activity.image_url;
              const menuUrl = activity.menu_file_path
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${menuBucket}/${encodeURIComponent(activity.menu_file_path)}`
                : null;
              const menuIsPdf = activity.menu_file_path?.toLowerCase().endsWith(".pdf") ?? false;

              return (
                <article className="activity-card" key={activity.id}>
                  <div className="activity-photo">
                    {image ? (
                      // User-provided URLs are allowed by the activity editor.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" />
                    ) : (
                      <Image src={activeDayInfo.photo} alt="" fill sizes="130px" />
                    )}
                  </div>
                  <div className="activity-content">
                    <div className="activity-card-top">
                      <span className="activity-time"><Icon name="clock" size={14} />{formatTime(activity.start_time)}</span>
                      <div className="activity-actions">
                        <button
                          className={`icon-action favorite-action${activity.is_favorite ? " is-favorite" : ""}`}
                          type="button"
                          aria-label={activity.is_favorite ? "Remove from favourites" : "Add to favourites"}
                          aria-pressed={activity.is_favorite}
                          onClick={() => void toggleFavorite(activity)}
                        >
                          <Icon name="star" size={17} />
                        </button>
                        <button className="icon-action edit-action" type="button" aria-label={`Edit ${activity.title}`} onClick={() => openEditActivity(activity)}>
                          <Icon name="edit" size={17} />
                        </button>
                        <button className="icon-action delete-action" type="button" aria-label={`Delete ${activity.title}`} onClick={() => void deleteActivity(activity)}>
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </div>
                    <h2>{activity.title}</h2>
                    <p className="activity-location"><Icon name="pin" size={15} />{activity.location}</p>
                    <div className="activity-chips">
                      <span className="travel-chip">{activity.transport} · {activity.travel_duration}</span>
                      <span className="duration-chip">{activity.activity_duration}</span>
                      {activity.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}
                    </div>
                    {(activity.notes || activity.created_by || activity.menu_file_path) && (
                      <button
                        className="details-toggle"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedIds((current) =>
                            expanded
                              ? current.filter((id) => id !== activity.id)
                              : [...current, activity.id],
                          )
                        }
                      >
                        {expanded ? "Hide details" : "View details"} <Icon name="arrow" size={14} />
                      </button>
                    )}
                    {expanded && (
                      <div className="activity-details">
                        {activity.notes && <p>{activity.notes}</p>}
                        {activity.created_by && <span>Added by {activity.created_by}</span>}
                        {menuUrl && (
                          <a href={menuUrl} target="_blank" rel="noreferrer">
                            Open cafe menu{menuIsPdf ? " (PDF)" : ""}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
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
          <section className="activity-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="editor-header">
              <div>
                <span className="editor-kicker">TRIP EDITOR</span>
                <h2 id="editor-title">{editingActivity ? "Edit activity" : "Add activity"}</h2>
              </div>
              <button className="editor-close" type="button" aria-label="Close activity form" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>
                <Icon name="close" size={21} />
              </button>
            </div>
            <form className="activity-form" onSubmit={saveActivity}>
              <label>
                <span>Day <b>*</b></span>
                <select value={draft.day_number} onChange={(event) => setDraft({ ...draft, day_number: Number(event.target.value) })}>
                  {days.map((day) => <option value={day.number} key={day.number}>Day {day.number} · {day.label}</option>)}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  <span>Time <b>*</b></span>
                  <input type="time" required value={draft.start_time} onChange={(event) => setDraft({ ...draft, start_time: event.target.value })} />
                </label>
                <label>
                  <span>Activity title <b>*</b></span>
                  <input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Sunway Lagoon adventure" />
                </label>
              </div>
              <label>
                <span>Location <b>*</b></span>
                <input required maxLength={180} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="e.g. Sunway Lagoon, Bandar Sunway" />
              </label>
              <div className="form-grid">
                <label>
                  <span>Travel method <b>*</b></span>
                  <select value={draft.transport} onChange={(event) => setDraft({ ...draft, transport: event.target.value })}>
                    {["Driving", "Walking", "Public transport", "Train / Monorail", "Grab / Taxi", "Other"].map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label>
                  <span>Travel duration <b>*</b></span>
                  <input required maxLength={40} value={draft.travel_duration} onChange={(event) => setDraft({ ...draft, travel_duration: event.target.value })} placeholder="e.g. 20 min" />
                </label>
              </div>
              <label>
                <span>Activity duration <b>*</b></span>
                <input required maxLength={40} value={draft.activity_duration} onChange={(event) => setDraft({ ...draft, activity_duration: event.target.value })} placeholder="e.g. 4 hrs" />
              </label>
              <label>
                <span>Image URL <small>(optional)</small></span>
                <input type="url" maxLength={1000} value={draft.image_url ?? ""} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="https://…" />
              </label>
              <label>
                <span>Cafe menu <small>(optional · images or PDF, max 50 MB)</small></span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(event) => {
                    setMenuFile(event.target.files?.[0] ?? null);
                    setRemoveExistingMenu(false);
                  }}
                />
                {menuFile && <small>Selected: {menuFile.name}</small>}
                {editingActivity?.menu_file_path && !removeExistingMenu && (
                  <span className="itinerary-menu-current">
                    A menu is attached.
                    <button type="button" onClick={() => setRemoveExistingMenu(true)}>
                      Remove menu
                    </button>
                  </span>
                )}
                {editingActivity?.menu_file_path && removeExistingMenu && (
                  <span className="itinerary-menu-current">
                    Attached menu will be removed when you save.
                    <button type="button" onClick={() => setRemoveExistingMenu(false)}>
                      Keep menu
                    </button>
                  </span>
                )}
              </label>
              <label>
                <span>Tags <small>(comma separated)</small></span>
                <input maxLength={300} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="e.g. Prayer time, food, family" />
              </label>
              <label>
                <span>Notes</span>
                <textarea rows={3} maxLength={2000} value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Anything the group should know…" />
              </label>
              <div className="editor-footer">
                <span>Changes are shared with your trip group.</span>
                <button type="submit" className="save-activity-button" disabled={isSaving}>
                  {isSaving ? "Saving…" : editingActivity ? "Save changes" : "Add to itinerary"}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
