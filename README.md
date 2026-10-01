# WanderSync

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase

The Supabase URL and publishable key are configured in `.env.local`. The root
`proxy.ts` refreshes authentication sessions, and `utils/supabase` contains the
browser and server clients.

The home page lets a traveler select their profile, and the itinerary screen
loads the shared schedule from Supabase. Activities can be added, edited,
favorited, and deleted from the itinerary.

Before using the app, run all eighteen SQL files in `supabase/migrations` in
order in the Supabase SQL Editor:

1. `20260929000000_update_travelers.sql`
2. `20260929000001_update_itinerary_activities.sql`
3. `20260929000002_grant_activity_favorite_insert.sql`
4. `20260929000003_fix_activity_insert.sql`
5. `20260929000004_seed_trip_days.sql`
6. `20260929000005_budget_items_schema.sql`
7. `20260929000006_fix_budget_category_policy.sql`
8. `20260929000007_seed_trip_roles.sql`
9. `20260929000008_seed_trip_checklists.sql`
10. `20260929000009_splitwise.sql`
11. `20260929000010_splitwise_custom_shares.sql`
12. `20260929000011_splitwise_payment_proofs.sql`
13. `20260929000012_booking_vault.sql`
14. `20260929000013_personal_checklist_completions.sql`
15. `20260929000014_checklist_group_visibility.sql`
16. `20260929000015_checklist_item_assignees.sql`
17. `20260929000016_shared_checklist_completions.sql`
18. `20260929000017_correct_traveler_name.sql`

The app uses a shared, unauthenticated trip: its Row Level Security policies
allow anyone with the public app URL to read and change these trip records.
This is suitable only for a private prototype; add real Supabase
Authentication and restrict the policies before using sensitive or public
production data. The first migration seeds/updates the existing `travelers`
records and allows the app to list profiles and save the last selection. The
activity migration extends the existing `itinerary_activities` table with
tags and creator fields. The image URL field accepts an externally hosted
image URL; activity images are not uploaded to Supabase Storage.
The budget migration extends the existing `budget_items` table for route,
item name, shared-cost splitting, creator, and permissions.
The roles migration seeds the four starter responsibilities and configures
shared read/write access for the `trip_roles` table.
The checklist migration seeds four shared checklist groups and starter items,
and enables shared read/write access for checklist items. The personal
checklist completions migration stores personal checklist ticks separately.
The checklist group visibility migration adds shared or traveler-specific
categories; items in each category follow that category's visibility in the
app. Since traveler selection is not Supabase authentication, this visibility
is not a security boundary until real authentication and matching RLS policies
are added. The checklist item assignees migration adds an optional traveler
assignment to items in shared categories.
The shared checklist completions migration stores shared-category ticks once
for all travelers, migrates existing shared-category ticks to that common
state, and enables Realtime updates for shared lists.
The traveler-name correction migration updates the Syahindah profile and
existing records from the previous misspelling.
The Splitwise migrations create shared participants, expenses, equal/custom
shares, and settlement records, then seed the three trip travelers. The
custom-shares migration updates the expense-saving database function; run it
after the initial Splitwise migration to enable custom participant amounts.
The payment-proofs migration adds a private Supabase Storage bucket and
settlement proof paths. Run it after the Splitwise migrations to enable receipt
uploads and signed proof links.
The Booking Vault migration seeds the accommodation and Sunway Lagoon records,
and creates shared database/storage access for their booking details and files.
The Transit page reads unique non-station destinations from the shared itinerary
and presents them alongside the curated interchange route guides.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
