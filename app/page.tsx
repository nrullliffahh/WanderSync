"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const travelerProfiles = [
  {
    name: "Iffah Afiqah",
    subtitle: "The trip planner",
    icon: "compass",
    color: "coral",
  },
  {
    name: "Syahindah Batrishia",
    subtitle: "The memory maker",
    icon: "camera",
    color: "sage",
  },
  {
    name: "Syauqina Qistina",
    subtitle: "The adventure seeker",
    icon: "sparkles",
    color: "blue",
  },
] as const;

type Traveler = (typeof travelerProfiles)[number] & { id: string };

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.9 9.1-1.8 4-4 1.8 1.8-4 4-1.8Z" />
      <path d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
    </svg>
  );
}

function TravelerIcon({
  name,
}: {
  name: (typeof travelerProfiles)[number]["icon"];
}) {
  if (name === "compass") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="17" />
        <path d="m30.5 17.5-4.2 8.8-8.8 4.2 4.2-8.8 8.8-4.2Z" />
        <path d="M24 4v4m0 32v4M4 24h4m32 0h4" />
      </svg>
    );
  }

  if (name === "camera") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M8 16h7l3-5h12l3 5h7a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z" />
        <circle cx="24" cy="27" r="8" />
        <circle cx="36" cy="21" r="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="m24 5 3.7 11.3L39 20l-11.3 3.7L24 35l-3.7-11.3L9 20l11.3-3.7L24 5Z" />
      <path d="m38 30 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM11 5l1.5 4.5L17 11l-4.5 1.5L11 17l-1.5-4.5L5 11l4.5-1.5L11 5Z" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [isLoadingTravelers, setIsLoadingTravelers] = useState(true);
  const [travelerLoadError, setTravelerLoadError] = useState<string | null>(null);
  const [selectedTraveler, setSelectedTraveler] = useState<Traveler | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadTravelers = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("travelers")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;

      const profiles = travelerProfiles.flatMap((profile) => {
        const row = data?.find((traveler) => traveler.name === profile.name);
        return row ? [{ ...profile, id: row.id }] : [];
      });

      setTravelers(profiles);
      if (profiles.length !== travelerProfiles.length) {
        setTravelerLoadError(
          "Some traveler profiles are missing. Check the Supabase setup and try again.",
        );
      } else {
        setTravelerLoadError(null);
      }
    } catch (error) {
      console.error("Unable to load traveler profiles:", error);
      setTravelerLoadError(
        "We couldn’t load traveler profiles. Check the Supabase setup and try again.",
      );
    } finally {
      setIsLoadingTravelers(false);
    }
  }, []);

  useEffect(() => {
    // Load the traveler records used by this shared trip.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTravelers();
  }, [loadTravelers]);

  async function saveTravelerSelection() {
    if (!selectedTraveler || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("travelers")
        .update({ last_selected_at: new Date().toISOString() })
        .eq("id", selectedTraveler.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Selected traveler record was not found.");

      setSaveMessage({
        type: "success",
        text: `${selectedTraveler.name} is saved to your trip.`,
      });
      router.push(`/itinerary?traveler=${encodeURIComponent(selectedTraveler.name)}`);
    } catch (error) {
      console.error("Unable to save traveler selection:", error);
      setSaveMessage({
        type: "error",
        text: "We couldn’t save your selection. Check your connection and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="trip-page">
      <div className="page-shell">
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Trip WanderSync home">
            <span className="brand-mark">
              <BrandIcon />
            </span>
            <span>
              <strong>Trip WanderSync</strong>
              <small>GOOD DAYS, TOGETHER</small>
            </span>
          </Link>
          <div className="saved-status">
            <span className="status-dot" />
            Your trip is saved
          </div>
        </header>

        <section className="welcome-panel" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" />
              YOUR SHARED TRAVEL HUB
            </span>
            <h1 id="welcome-title">
              One plan.
              <br />
              Three travelers.
              <br />
              <span>Endless little moments.</span>
            </h1>
            <p className="intro-copy">Pick your profile and let the good times begin.</p>
            <div className="trip-details">
              <span className="detail-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="6" width="16" height="15" rx="2" />
                  <path d="M8 3v5m8-5v5M4 10h16m-11 4h2m3 0h2m-7 3h2" />
                </svg>
              </span>
              <span>
                <strong>4 days</strong>
                <span className="detail-divider" />
                3 travelers
              </span>
              <span className="detail-destination">Kuala Lumpur, MY</span>
            </div>
          </div>

          <div className="welcome-photo">
            <Image
              src="/images/home-turntable.png"
              alt="Red vinyl record playing beside a vase of flowers"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 43vw"
            />
          </div>
        </section>

        <section className="profile-section" aria-labelledby="profile-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">FIRST THINGS FIRST</span>
              <h2 id="profile-title">Who&apos;s wandering today?</h2>
              <p>Choose your profile to open your shared trip.</p>
            </div>
            <span className="profile-count">01 <span>/ 03</span></span>
          </div>

          {isLoadingTravelers ? (
          <div className="traveler-loading" role="status">
            Loading traveler profiles…
          </div>
          ) : (
          <div className="traveler-grid">
            {travelers.map((traveler, index) => {
            const isSelected = selectedTraveler?.id === traveler.id;

              return (
                <button
                  className={`traveler-card ${traveler.color}${isSelected ? " selected" : ""}`}
                  type="button"
                  key={traveler.name}
                  onClick={() => {
                    setSelectedTraveler(traveler);
                    setSaveMessage(null);
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="card-topline">
                    <span className="traveler-number">
                      0{index + 1} <span>TRAVELER</span>
                    </span>
                    <span className="select-indicator" aria-hidden="true">
                      {isSelected ? "✓" : ""}
                    </span>
                  </span>
                  <span className="traveler-card-content">
                    <span className="traveler-avatar">
                      <TravelerIcon name={traveler.icon} />
                    </span>
                    <span className="traveler-info">
                      <strong>{traveler.name}</strong>
                      <span>{traveler.subtitle}</span>
                    </span>
                    <span className="card-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </span>
                </button>
              );
            })}
            </div>
          )}

          <div className="continue-row">
            <p>
              <span className="tiny-sparkle" aria-hidden="true">✳</span>
              The best trips are the ones we share.
            </p>
            <button
              className="continue-button"
              type="button"
              disabled={!selectedTraveler || isSaving}
              onClick={saveTravelerSelection}
            >
              {isSaving
                ? "Saving selection…"
                : selectedTraveler
                  ? `Continue as ${selectedTraveler.name}`
                  : "Select a profile"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {travelerLoadError && (
            <p className="selection-confirmation error" role="alert">
              {travelerLoadError}
              <button
                className="retry-travelers"
                type="button"
                onClick={() => {
                  setIsLoadingTravelers(true);
                  void loadTravelers();
                }}
              >
                Retry
              </button>
            </p>
          )}
          {saveMessage && (
            <p
              className={`selection-confirmation ${saveMessage.type}`}
              role={saveMessage.type === "error" ? "alert" : "status"}
            >
              <span aria-hidden="true">
                {saveMessage.type === "success" ? "✓" : "!"}
              </span>
              {saveMessage.text}
            </p>
          )}
        </section>
        <footer className="page-footer">
          MADE FOR THE MEMORIES YOU HAVEN&apos;T MADE YET
          <span>✳</span>
        </footer>
      </div>
    </main>
  );
}
