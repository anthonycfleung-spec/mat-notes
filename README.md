# Mat Notes

Personal BJJ training app: set an intention, train, reflect. Phone web app (PWA); all data stays on the phone (IndexedDB via Dexie).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, also on your Wi-Fi address for a phone
npm test           # logic tests (stats, program schedule, dates)
npm run build      # production build in dist/
npm run deploy     # test, build and publish to GitHub Pages
```

## Where things are

- `src/db/` types, Dexie schema, starting content from the Notion BJJ Log (`seed.ts`, runs once on first open)
- `src/lib/` dates, stats (hit rates, most improved, program position), actions (sessions, reflections), backup
- `src/screens/` Today, IntentionEditor, Reflect, Skills, SkillDetail, Programs, ProgramEditor, ProgramDay, GamePlan, Progress
- `src/components/ui.tsx` rings, sparkline, glyphs, status track, pips, tab bar, sheet, toast
- `src/styles.css` design tokens (Night Session+ / direction E)

## Data

Nothing leaves the phone. Progress → Backup saves a JSON file through the share sheet (Files, iCloud Drive…) and can restore one.
The app asks the browser to keep its storage (`navigator.storage.persist()`); on iPhone, add it to the Home Screen.
