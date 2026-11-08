# Research Board

A Figma-style canvas for visual research, with an AI research assistant on the right.

Pick a frame size, then type something like *"sculptural artists who make work about bus stations"*. You get a list of real candidates with sources. **Keep** or **skip** each one, then **generate a card** (short bio, key works, materials & process, connection to your research, exhibitions). The card lands on your board with its image and source links. You can also add your own notes, links and images.

Built with Next.js, React, Zustand and the Claude API with its built-in web search tool.

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Open http://localhost:3000.

**No key yet?** It still runs in **mock mode**: the research panel returns placeholder results, so you can work on the UI for free.

### Getting an API key
1. Go to https://console.anthropic.com and create an API key.
2. Add some credit, and **set a monthly spend limit** (Settings → Limits).
3. If the panel says web search isn't enabled, turn it on in the Console (Settings → Privacy).
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
| Add a link / image | **L** / **I**, or paste (**Ctrl/Cmd+V**) or drag links and images onto the canvas |
| Paste a screenshot | Ctrl/Cmd+V (images up to 1.5 MB, stored in your browser) |
| Delete | Select, then **Delete** / **Backspace** |
| Research panel | **Ctrl/Cmd + \\** or the button at top right |
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
  api/unfurl/route.ts      Free link previews (page title / og:image)
components/
  Editor.tsx               Top bar, tools, shortcuts, paste/drop, layout
  Canvas.tsx               Pan / zoom / drag / resize (the Figma-like part)
  CardView.tsx             How each card type looks
  LeftPanel.tsx            Layers list + selected-item controls
  ResearchPanel.tsx        The collapsible AI panel
lib/
  store.ts                 All board data (Zustand, saved to localStorage)
  ai.ts                    Claude calls + parsing JSON from the reply
  sections.ts              Card section types. Add your own here
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
- [ ] Export the frame as PNG / PDF
- [ ] Edit generated card text

**Research**
- [ ] Image search for a candidate (e.g. Brave Search API or museum open-access APIs)
- [ ] "Research this card further": ask follow-up questions about a card
- [ ] Search modes: artists / apps & products / exhibitions / writing
