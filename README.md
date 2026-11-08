# Research Board

A Figma-style canvas for visual research, with an AI research assistant on the right.

Made for **visual research**. Pick a frame size, then:

- **Search like Google:** type anything in the right panel and press Enter. **Web** shows normal results (add any page to your board, pull its images, or summarize it into a card). **Images** shows an image grid: click to select, then add them with their sources.
- **AI research:** choose what you're looking for (artists, museums & galleries, articles & writing, exhibitions, apps & products, or anything) and describe it, e.g. *"sculptural artists who make work about bus stations"*. Keep or skip the results, then **pull their images** onto the canvas or **generate a card** (sections depend on the type) with source links.
- **Pull images from any web page:** paste a page link, pick images from a grid, done.
- **Automatic citations:** every image remembers its page, site, title, author, publish date and the date you saved it. Copy any citation in **Chicago, MLA or APA**, or open **Citations** for a bibliography of the whole page or board.
- **Preview pages next to your board:** click any search result or link to open it in a side pane. Sites that allow it show live; others show a clean **reader view** where clicking an image adds it to your board with its citation. **Open** sends it to your browser (or Cmd/Ctrl-click any link).
- **Pages:** split a board into pages (e.g. "Artists", "Museums", "Materials").

Built with Next.js, React, Zustand and the Claude API with its built-in web search tool. Minimal black, white and grey theme with the Geist font (bundled, no external requests).

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Open http://localhost:3000.

**Optional: Brave Search key** for fast, Google-like Web and Images results. Get one at https://api-dashboard.search.brave.com (it includes free monthly credit) and add `BRAVE_API_KEY=...` to `.env.local`. Without it, Web/Images use Claude's web search instead (slower; images are collected from the top result pages).

**No key yet?** It still runs in **mock mode**: the research panel returns placeholder results, so you can work on the UI for free.

### Getting an API key
1. Go to https://platform.claude.com (the Claude Console), sign in or create an account, then **Settings → API keys → Create key**. The key starts with `sk-ant-` and is shown only once.
2. Add some credit, and **set a monthly spend limit** (Settings → Limits).
3. If the panel says web search isn't enabled, turn it on in the Console in the Console settings.
4. Put the key in `.env.local` as `ANTHROPIC_API_KEY=...`. Never commit this file; it's already in `.gitignore`.

**Cost:** each web search is $0.01 plus tokens. With the default cheap model (Haiku 5.5), one research search or one generated card costs roughly 2–4¢. Check the real numbers in the Console's usage page.

### Deploy on Vercel
Push to GitHub → import the repo in Vercel → add `ANTHROPIC_API_KEY` under Project → Settings → Environment Variables → deploy.

---

## How to use

| Action | How |
|---|---|
| Pan | Scroll, hold **Space** and drag, or use the Hand tool (**H**) |
| Zoom | **Ctrl/Cmd + scroll**, pinch, or **Ctrl/Cmd +/−**. **Shift+1** fits the frame |
| Add a note | **N**, then click the canvas. Double-click a note (or press Enter) to edit |
| Add a link | **L**, or paste / drag a link onto the canvas |
| Add images from a web page | **I**, paste the page link, pick images. Or click **Images** on a research result, or **Find images** on a card |
| Drag an image from another site | Drop it on the canvas: it's cited automatically (page details are filled in when the browser passes the page link) |
| Paste a screenshot | Ctrl/Cmd+V (up to 1.5 MB, stored in your browser). Add its page URL in the left panel to cite it |
| Cite something | Select an image or link: edit its source info, pick a style, **Copy citation**. **Citations** (top bar) lists everything |
| Pages | **+** in the left panel. Double-click to rename, drag to reorder, **PgUp/PgDn** to switch. "Move to page…" on a selected item |
| Delete | Select, then **Delete** / **Backspace** |
| Search panel | **Ctrl/Cmd + \\** or the search button in the bottom dock |
| Resize a card | Drag the handle at its bottom-right corner (width), or use **Size −/+** in the left panel |

Boards are saved in your browser (localStorage) for now.

---

## Project map

```
app/
  page.tsx                 Start screen: frame presets + your boards
  board/[id]/page.tsx      Loads a board into the editor
  api/research/route.ts    Prompt → candidate list (Claude + web search)
  api/card/route.ts        Candidate → card sections + sources + preview image
  api/unfurl/route.ts      Free link previews + citation info (title, site, author, date)
  api/images/route.ts      Lists the images on a web page (for the image picker)
  api/search/route.ts      Web / image search (Brave, or Claude fallback)
  api/reader/route.ts      Reader view of a page + whether it can be shown live
components/
  Editor.tsx               Top bar, tools, shortcuts, paste/drop, layout
  Canvas.tsx               Pan / zoom / drag / resize (the Figma-like part)
  CardView.tsx             How each card type looks
  LeftPanel.tsx            Pages + selected-item controls
  SearchPanel.tsx          Right panel: Web / Images / AI research tabs
  ResearchPanel.tsx        The AI research tab (research types, keep/skip, cards)
  ImagePicker.tsx          Pick images from web pages
  PreviewPane.tsx          Web page preview next to the board (live / reader)
  CitationEditor.tsx       Source info + formatted citation for one item
  CitationsModal.tsx       Bibliography for the page / board
lib/
  store.ts                 All board data (Zustand, saved to localStorage)
  ai.ts                    Claude calls + parsing JSON from the reply
  researchTypes.ts         Research types and their card sections. Add your own here
  citation.ts              Chicago / MLA / APA formatting
  search.ts                Search engine adapters (Brave, Claude fallback, mock)
  reader.ts                Reader view: cleans a page down to text + images
  preview.ts               Which page is open in the preview pane
  presets.ts               Frame sizes and note colors
  web.ts                   Fetching pages safely for previews
  mock.ts                  Fake data for mock mode
```

---

## Roadmap

**Next: let other people use it**
- [ ] Accounts and a database (Supabase): move boards out of localStorage
- [ ] Credits: count each AI action in the database and check it on the server **before** calling Claude
- [ ] Free tier (e.g. 25 credits/month) and a paid plan with Stripe. Build it in test mode first
- [ ] Rate limiting per user and IP

**Canvas**
- [ ] Multi-select and group move
- [ ] Undo / redo
- [ ] Arrows / connectors between cards
- [ ] Export the frame as PNG / PDF, with an image-credits page
- [ ] Save images to storage (so they don't break if the original site moves them)
- [ ] Edit generated card text

**Research**
- [ ] Browser extension: clip an image from any site with one click (most reliable citations)
- [ ] Image search for a query (e.g. Brave Search API, museum open-access APIs)
- [ ] "Research this card further": ask follow-up questions about a card
- [ ] Search modes: artists / apps & products / exhibitions / writing
