# Deskbuddy Stickman

A little set of stickmen who wander two of your open tabs at once, doodle bits of code, hold sticky notes, and have moods.

**New in v1.4: Smart Task System!** Right-click any stickman to assign them intelligent tasks like eliminate, eat, follow, attack, protect, collect, build, or explore. Stickmen can now work autonomously on assigned tasks!

## Install (Chrome / Edge, unpacked)

1. Unzip this folder somewhere permanent (don't delete it after — Chrome
   loads the extension from these files directly).
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `deskbuddy-extension` folder.
5. Open a couple of regular web pages (http/https — not chrome:// pages
   or the Web Store, extensions can't run there). Within a couple of
   minutes the stickman will appear on one of them.

## Using it

- **Click the stickman** to pop out a sticky note. Type in it, drag it
  anywhere on the page, click the ✕ to remove it.
- **Click the small ⌘ button** next to him to open the command console.
- Type `help` in the console to see every command:
  - `note` — new sticky note
  - `write` — doodle a code snippet right now
  - `doodle` — scribble annotations on page elements
  - `sit` / `walk` — control his pose
  - `dance` / `wave` / `meditate` / `party` / `selfie` — fun activities
  - `pet` — summon a pet companion
  - `tomato` / `shatter` / `spray` / `sparkle` — chaotic fun
  - `cook` / `climb` — more activities
  - `mood <name>` — happy, angry, sad, neutral, emotional, surprised
  - `speed <name>` — slow, normal, fast
  - `jump` — move him to a different open tab immediately
  - `hide` / `show`
  - `clear` — remove all sticky notes
  - `setup <type>` — workout | chair | code | basketball | smash
  - `sleep` / `wake` — control sleep
  - `needs` — check current needs status for all stickmen
  - `feed [name]` — feed stickman (hunger +30). Optional: yellow/red/blue/green
  - `play [name]` — play with stickman (happiness +25, social +20)
  - `comfort [name]` — comfort stickman (happiness +20, social +15)
  - `rest [name]` — let stickman rest (energy +35)
  - `swim` — go swimming (fun +20, energy -10)
  - `fish` — go fishing (fun +15, chance for food)
  - `garden` — do gardening (fun +18, energy -15)
  - `read` — read a book (fun +25, happiness +15)
  - `game` — play video games (fun +30, happiness +20, energy -20)
  - `highfive <name>` — high-five another stickman (social +25)
  - `compete <name>` — compete with another stickman (winner gets bonus)
  - `chat <name>` — chat with another stickman (social +30, happiness +20)
  - `weather <type>` — set weather: sunny | rainy | snowy | cloudy
  - `rps` — play rock-paper-scissors
  - `guess` — play guess the number (1-100)
  - `equip <item>` — equip accessory: hat, crown, glasses, sunglasses, bow, flower, headphones, scarf, cape
  - `remove` — remove current accessory
  - `accessories` — list available accessories
  - `achievements` — view achievements
  - `tasks [name]` — view tasks for stickman (defaults to yellow)
  - `cleartasks [name]` — clear all tasks for stickman (defaults to yellow)

### Needs System

Each stickman (Yellow, Red, Blue, Green) now has **8 individual needs** that decay over time:

- **🍽️ Hunger** — Decays over time. Feed with `feed [name]` command
- **💧 Thirst** — Decays over time. Keep them hydrated!
- **⚡ Energy** — Decays over time. Use `rest [name]` command
- **😊 Happiness** — Decays over time. Use `play [name]` or `comfort [name]` commands
- **👥 Social** — Decays over time. Interact with other stickmen
- **🧼 Hygiene** — Decays over time. Stay clean!
- **🎮 Fun** — Decays over time. Play games and do activities
- **🛋️ Comfort** — Decays over time. Keep them comfortable

The needs panel is draggable - click and drag to move it anywhere on the page!

### Personality System

Each stickman color has unique personality traits affecting need decay:
- **Yellow** — Balanced and adaptable (normal decay rates)
- **Red** — Energetic, burns through needs faster (1.5x energy decay)
- **Blue** — Calm, needs decay slower (0.7x energy decay)
- **Green** — Very social, needs more interaction (1.5x social decay)

### New Activities

- `swim` — Go swimming (fun +20, energy -10)
- `fish` — Go fishing (fun +15, chance for food)
- `garden` — Do gardening (fun +18, energy -15)
- `read` — Read a book (fun +25, happiness +15)
- `game` — Play video games (fun +30, happiness +20, energy -20)

### Stickman Interactions

- `highfive <name>` — High-five another stickman (social +25)
- `compete <name>` — Compete with another stickman (winner gets bonus)
- `chat <name>` — Chat with another stickman (social +30, happiness +20)

### Weather System

- `weather <type>` — Set weather: sunny | rainy | snowy | cloudy
- Weather affects stickman behavior and needs
- Rain makes them stay inside, sunshine boosts happiness, snow makes them playful

### Time-Based Behaviors

- Morning: More energetic, productive
- Afternoon: Normal activity with occasional coffee breaks
- Evening: Winding down, more social
- Night: Tired, likely to sleep

### Mini-Games

- `rps` — Play rock-paper-scissors against the stickman
- `guess` — Play guess the number (1-100) with hints

### Customization

- `equip <item>` — Equip accessories: hat, crown, glasses, sunglasses, bow, flower, headphones, scarf, cape
- `remove` — Remove current accessory
- `accessories` — List available accessories

### Achievements System

- `achievements` — View your achievements
- Unlock achievements by completing various tasks
- Achievements give happiness and fun bonuses
- Examples: First Meal, Social Butterfly, Weather Master, Fashionista, High Fiver

### Smart Task System

**Right-click** any stickman to open a context menu and assign them intelligent tasks:

- **🗑️ Eliminate** — Remove a stickman or eliminate page elements
- **🍽️ Eat** — Eat page elements to satisfy hunger
- **🚶 Follow** — Follow another stickman around the page
- **⚔️ Attack** — Attack another stickman (reduces their happiness/energy)
- **🛡️ Protect** — Protect another stickman (boosts their happiness/comfort)
- **📦 Collect** — Collect items from the page (links, buttons, inputs)
- **🔨 Build** — Build decorative elements on the page
- **🔍 Explore** — Explore the page by moving around randomly

After choosing an action, select a target:
- **Page Elements** — Target the page itself
- **Yellow/Red/Blue/Green** — Target another specific stickman

Stickmen will execute tasks autonomously in a queue. Multiple tasks can be queued and they'll be completed in order.

**Console commands for tasks:**
- `tasks [name]` — View current tasks for a stickman
- `cleartasks [name]` — Clear all queued tasks for a stickman

He's active on two random open tabs at a time. Every 45 seconds–2.5
minutes, one of those two tabs gets swapped for a different random
tab (so at any moment you might catch him on two different pages).
He picks new poses/moods over time, and occasionally types out a
little snippet of made-up HTML/CSS/JS next to himself just for
flavor — it's cosmetic only and never touches the real page content.

## Notes / limitations

- Manifest V3, Chrome/Edge only (no Firefox support in this build).
- He can't appear on `chrome://` pages, the Web Store, or PDFs opened
  directly in the browser — those don't allow content scripts.
- Sticky notes and his behavior loop reset if you reload a page (nothing
  is saved between reloads in this version).
- Needs also reset on page reload.
