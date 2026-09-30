"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type Activity = {
  id: string;
  title: string;
  location: string;
};

const routeGuides = [
  {
    day: "DAY 1 · PETANG",
    title: "Apartment → LaLaport BBCC",
    subtitle: "Pergi · KL Monorail Line",
    duration: "~18 MIN",
    steps: [
      {
        line: "JALAN KAKI",
        detail: <>Dari <b>The Colony</b> ke <b>Stesen Monorel Medan Tuanku</b> <span className="route-step-time">· ~5–6 min</span></>,
      },
      {
        line: "MONOREL",
        badge: "MR9 → MR4",
        detail: <>Naik di <b>Medan Tuanku</b>, arah <em>KL Sentral (Platform 1)</em>.</>,
        subdetail: <>Turun di <b>Hang Tuah</b> (5 stesen: Bukit Nanas → Raja Chulan → Bukit Bintang → Imbi → Hang Tuah)</>,
      },
      {
        line: "JALAN KAKI",
        detail: <>Keluar di Hang Tuah &amp; ikut jejantas pejalan kaki berbumbung ke <b>LaLaport BBCC</b> <span className="route-step-time">· ~2 min</span></>,
      },
    ],
  },
  {
    day: "DAY 1 · MALAM",
    title: "Panda Mala / Imbi → Apartment",
    subtitle: "Balik · KL Monorail Line",
    steps: [
      {
        line: "JALAN KAKI",
        detail: <>Dari <b>Panda Mala</b> ke Stesen Monorel Imbi <span className="route-step-time">· ~4–5 min</span></>,
      },
      {
        line: "MONOREL",
        badge: "MR5 → MR9",
        detail: <>Naik di <b>Imbi</b>, arah <em>Titiwangsa (Platform 2)</em>.</>,
        subdetail: <>Turun di <b>Medan Tuanku</b> (4 stesen: Bukit Bintang → Raja Chulan → Bukit Nanas → Medan Tuanku)</>,
      },
      {
        line: "JALAN KAKI",
        detail: <>Dari Stesen Medan Tuanku balik ke <b>The Colony</b> <span className="route-step-time">· ~5–6 min</span></>,
      },
    ],
  },
  {
    day: "DAY 3 · PAGI",
    title: "Apartment → Kwai Chai Hong / Pasar Seni",
    subtitle: "Pergi · Monorel + MRT Kajang Line",
    steps: [
      {
        line: "JALAN KAKI",
        detail: <>Dari <b>The Colony</b> ke Stesen Monorel Medan Tuanku <span className="route-step-time">· ~4–5 min</span></>,
      },
      {
        line: "MONOREL",
        badge: "MR9 → MR6",
        detail: <>Naik di <b>Medan Tuanku</b>, arah <em>KL Sentral (Platform 1)</em>.</>,
        subdetail: <>Turun di <b>Bukit Bintang</b> (3 stesen)</>,
      },
      {
        line: "PERTUKARAN",
        detail: <>Ikut papan tanda laluan pertukaran berbumbung dari Stesen Monorel Bukit Bintang ke Stesen MRT Bukit Bintang <b>(KG18A)</b>.</>,
      },
      {
        line: "MRT KAJANG LINE",
        badge: "KG18A → KG16",
        detail: <>Naik di <b>Bukit Bintang</b>, arah <em>Kwasa Damansara (Platform 1)</em>.</>,
        subdetail: <>Turun di <b>Pasar Seni</b> (2 stesen: Merdeka → Pasar Seni)</>,
      },
      {
        line: "JALAN KAKI",
        detail: <>Keluar melalui <b>Pintu A (Jalan Sultan)</b> dan jalan kaki ke <b>Kwai Chai Hong</b> <span className="route-step-time">· ~3 min</span></>,
      },
    ],
  },
  {
    day: "DAY 3 · PETANG / MALAM",
    title: "SMAI Cafe / Pasar Seni → Apartment",
    subtitle: "Balik · MRT Kajang Line + Monorel",
    steps: [
      {
        line: "JALAN KAKI",
        detail: <>Dari <b>SMAI Cafe (Jalan Tun H.S. Lee)</b> ke Stesen MRT Pasar Seni, Pintu A <span className="route-step-time">· ~4 min</span></>,
      },
      {
        line: "MRT KAJANG LINE",
        badge: "KG16 → KG18A",
        detail: <>Naik di <b>Pasar Seni</b>, arah <em>Kajang (Platform 2)</em>.</>,
        subdetail: <>Turun di <b>Bukit Bintang</b> (2 stesen: Merdeka → Bukit Bintang)</>,
      },
      {
        line: "PERTUKARAN",
        detail: <>Ikut laluan pejalan kaki berhubung dari Stesen MRT Bukit Bintang ke Stesen Monorel Bukit Bintang.</>,
      },
      {
        line: "MONOREL",
        badge: "MR6 → MR9",
        detail: <>Naik di <b>Bukit Bintang</b>, arah <em>Titiwangsa (Platform 2)</em>.</>,
        subdetail: <>Turun di <b>Medan Tuanku</b> (3 stesen: Raja Chulan → Bukit Nanas → Medan Tuanku)</>,
      },
      {
        line: "JALAN KAKI",
        detail: <>Dari Stesen Medan Tuanku pulang ke <b>The Colony</b> <span className="route-step-time">· ~4–5 min</span></>,
      },
    ],
  },
] as const;

const icons: Record<string, ReactNode> = {
  train: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M8 21l2-3m6 3-2-3M5 11h14M9 7h.01M15 7h.01M8 14h.01M16 14h.01" /></>,
  walk: <><circle cx="13" cy="5" r="2" /><path d="m10 22 2-6-3-3 2-5 4 3 3 1m-8 4-4 6m8-7 3 7" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-14 5h3" /></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

function Icon({ name, size = 18 }: { name: keyof typeof icons; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const message = Reflect.get(error, "message");
    if (typeof message === "string" && message) return message;
  }
  return "An unknown database error occurred.";
}

export default function Transit({ traveler }: { traveler: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("itinerary_activities")
        .select("id, title, location")
        .order("title");
      if (error) throw error;
      setActivities((data ?? []) as Activity[]);
      setLoadError(null);
    } catch (error) {
      const message = errorText(error);
      console.error(`Unable to load trip activities for transit guide: ${message}`);
      setLoadError(`We couldn’t load your scheduled locations: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Populate daily route shortcuts from the shared itinerary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActivities();
  }, [loadActivities]);

  const tripDestinations = useMemo(() => {
    const seen = new Set<string>();

    return activities.filter((activity) => {
      const title = activity.title.trim();
      const location = activity.location.trim();
      if (!title && !location) return false;
      if (/\b(stesen|station)\b/i.test(title)) return false;

      const key = `${title || location}|${location}`.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activities]);

  return (
    <main className="itinerary-page transit-page">
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
          <Link href={`/booking-vault?traveler=${encodeURIComponent(traveler)}`}>Booking Vault</Link>
          <span className="nav-active">Transit</span>
        </nav>
        <Link className="active-traveler" href="/" title="Switch traveler">
          <span className="mini-avatar">{traveler.split(" ")[0].slice(0, 2)}</span>
          {traveler.split(" ")[0]}
          <span className="switch-label">Switch</span>
        </Link>
      </header>

      <div className="transit-shell">
        <div className="transit-heading">
          <div>
            <span className="itinerary-eyebrow">MOVE AROUND KL WITH EASE</span>
            <h1>Transit &amp; navigation</h1>
            <p>Clear interchange directions and a short list of your trip destinations.</p>
          </div>
          <Link className="transit-itinerary-link" href={`/itinerary?traveler=${encodeURIComponent(traveler)}`}>
            <Icon name="clock" size={16} /> Open itinerary
          </Link>
        </div>

        <section className="transit-section">
          <div className="transit-section-heading">
            <div>
              <span className="transit-kicker">YOUR TRIP ROUTE GUIDE</span>
              <h2>Common interchange routes</h2>
            </div>
            <span className="transit-source-note">Check live service updates before travelling.</span>
          </div>
          <div className="transit-guides">
            {routeGuides.map((guide) => (
              <article className="transit-guide-card" key={guide.title}>
                <div className="transit-guide-meta">
                  <span className="transit-guide-day">{guide.day}</span>
                  {"duration" in guide && <span className="transit-guide-duration">{guide.duration}</span>}
                </div>
                <div className="transit-guide-heading">
                  <span className="transit-guide-icon"><Icon name="train" size={20} /></span>
                  <div><h3>{guide.title}</h3><span>{guide.subtitle}</span></div>
                </div>
                <ol className="transit-steps">
                  {guide.steps.map((step, index) => (
                    <li
                      className={step.line.includes("MONOREL") || step.line.includes("MRT") ? "transit-step-rail" : ""}
                      key={`${step.line}-${index}`}
                    >
                      <span className="transit-step-number">{index + 1}</span>
                      <div className="transit-step-content">
                        <div className="transit-step-label">
                          <strong>{step.line}</strong>
                          {"badge" in step && <span className="transit-step-badge">{step.badge}</span>}
                        </div>
                        <p>{step.detail}</p>
                        {"subdetail" in step && <p className="transit-step-subdetail">{step.subdetail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="transit-section">
          <div className="transit-section-heading">
            <div>
              <span className="transit-kicker">BASED ON YOUR SHARED PLAN</span>
              <h2>Trip destinations</h2>
            </div>
          </div>
          {loadError && <div className="splitwise-alert" role="alert"><span>{loadError}</span><button type="button" onClick={() => { setIsLoading(true); void loadActivities(); }}>Retry</button></div>}
          {isLoading ? (
            <div className="splitwise-loading" role="status">Loading trip destinations…</div>
          ) : (
            <div className="transit-destination-grid">
              {tripDestinations.length === 0 ? (
                <p className="transit-day-empty">No trip destinations to show yet. Add destinations to your itinerary and they’ll appear here.</p>
              ) : tripDestinations.map((activity) => (
                <article className="transit-destination-card" key={activity.id}>
                  <span className="transit-destination-marker"><Icon name="pin" size={19} /></span>
                  <div>
                    <strong>{activity.title || activity.location}</strong>
                    <small className="transit-destination-location">
                      <Icon name="pin" size={13} />
                      {activity.location || "Location not added"}
                    </small>
                  </div>
                  <div className="transit-destination-maps" aria-label={`Open destination in a map app: ${activity.title || activity.location}`}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([activity.title, activity.location].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?q=${encodeURIComponent([activity.title, activity.location].filter(Boolean).join(", "))}&navigate=yes`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Waze
                    </a>
                    <a
                      href={`https://maps.apple.com/?q=${encodeURIComponent([activity.title, activity.location].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Apple Maps
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
