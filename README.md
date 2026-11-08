# Halaqa: a Quran classroom

Halaqa is a website for teaching Quran. It opens any of the 604 pages of the Madani mushaf so you can point, draw, highlight and mark mistakes while your student recites. Every student gets their own notebook with bookmarks, highlights, drawings, mistakes, notes and a lesson log.

It is a plain website (HTML, CSS and JavaScript). There is no server and nothing to install. That is why it can run for free, all day and every day, on GitHub Pages.

## What it does

**Teaching tools**
- A tool panel down the left side (along the bottom on a phone) that shows the name of every button. Fold it to icons only with **Hide labels** at its top.
- A custom cursor: a gold eight-pointed star that follows the mouse. It turns into a brush preview when you draw, and a red dot for the laser. Settings has a large version for screen sharing.
- Pen with 7 colours (and any colour you like), 4 sizes, and pressure for a stylus.
- Highlighter that sits under the letters, so the text stays sharp. Hold Shift for a straight line.
- Eraser that rubs out where you drag, or removes a whole line with one touch. Plus "Clear page".
- Laser pointer whose trail fades by itself, for online lessons.
- Mark mistakes: tap a word while your student recites. Choose memory slip, tajweed or pronunciation. Marked words collect in the student's practice list.
- Hide text for a memory test. Tap a word to reveal it, or press N for the next word. A second mode shows only the first word of each ayah.
- Undo and redo for everything on the page.

**The mushaf**
- 604 pages, surah banners, basmala and ayah markers, with a ruled line under every line of text (switch it off in Settings).
- Two scripts: Uthmani (Madinah) and IndoPak. Switch with the **Script** button or the `I` key.
- **Your own printed mushaf.** Add the PDF of a mushaf in **Settings, Your mushaf** and teach from its real pages, with the same writing and the same printed tajweed colours. See "Your mushaf" below.
- Tajweed colours, with a different colour for each of 17 rules: hamzat al-wasl, lam shamsiyyah, silent letters, the four kinds of madd, qalqalah, ghunnah, ikhfa, iqlab, both kinds of idgham, the meem rules and the two idgham mutajanisayn/mutaqaribayn. The colour key is on the **Tajweed** tab of the notebook, where you can switch single rules off to practise one at a time. Tajweed colours work with the Uthmani script; no free source has colour-coded IndoPak text.
- Go to any surah, juz or page. Swipe or use the arrow keys to turn pages.
- Tap an ayah to recite it, highlight it in one of 5 colours, bookmark it, copy it, read its translation, add it to the lesson log or share a link to it.
- Recitation ayah by ayah, with a choice of reciters. Repeat each ayah up to 10 times, loop a selection or keep going. Good for memorisation.
- English and Urdu translation shown together under each ayah (Saheeh International and Jalandhry). Swap either one for any of the other translations or tafsirs in Settings, or turn the second one off.
- Search in Arabic (with or without vowel marks) or in a translation. Type `2:255` to jump to an ayah.

**Students**
- Unlimited students, each with their own copy of the mushaf.
- Bookmarks with a name and colour. The **Bookmarks** list (button on the left, or `B`) shows the student's bookmarks; tap one to go straight to its page.
- Page notes, lesson log with grades, practice words, and a progress grid of memorized pages for all 30 juz.
- The app remembers where each student stopped.

**Everything else**
- Three themes: Lapis, Daylight and Night.
- Works on computers, tablets (including iPad with Apple Pencil) and phones.
- Install it like an app and open it offline after the first visit.
- Backups you can download and restore, for all students or one student.
- Keyboard shortcuts. Press `?` in the app to see them.

## Your mushaf (a PDF on your device)

In **Settings, Your mushaf**, choose the PDF of a printed mushaf. Halaqa keeps its page pictures in the browser on that device, so:

- The PDF is **not** uploaded to GitHub or anywhere else, and it is not part of backups. Add it once on each device you teach from.
- It needs about as much free space as the PDF itself (the 13-line mushaf is 84 MB).

For the **13-line mushaf with colour-coded tajweed** (the 851-page `Quran_13_lines_with_tajweed_color.pdf`), Halaqa has a page index (`mushaf13.json`) that knows where all 6,236 ayahs, every surah header and every juz start are. On its pages you can tap an ayah to select it, highlight it, recite it with the ayah marked as it plays, bookmark it, see its translation, and use the memory test ayah by ayah. Surah and juz navigation use the mushaf's own pages, including the IndoPak juz starts (for example juz 4 at 3:92). The Tajweed tab shows the mushaf's seven colours.

Other mushaf PDFs work too, as pages for reading, drawing, highlighting with the pen and bookmarking, without tapping ayahs.

Marking mistakes word by word only works in the Uthmani and IndoPak views; on mushaf pages, circle mistakes with the pen. Each view keeps its own drawings.

## Put it online for free (GitHub Pages)

You need a free GitHub account. The repository must be **public** for free GitHub Pages hosting.

1. Sign in at [github.com](https://github.com) and click **New** (or the **+** at the top, then **New repository**).
2. Name it `halaqa`, choose **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Add all the files from this folder:
   - On a computer: unzip the download, open the folder, select every file inside it and drag them onto the GitHub page.
   - On a phone: unzip the download in your Files app first, then tap **choose your files** and select all the files.
5. Click **Commit changes**.
6. Open **Settings** (at the top of the repository), then **Pages** in the left menu.
7. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose the branch **main** and the folder **/ (root)**, then click **Save**.
8. Wait one or two minutes and refresh the Pages settings. Your link appears at the top. It looks like this:
   `https://YOUR-GITHUB-NAME.github.io/halaqa/`

That link stays online all the time, for free. To update the app later, upload the changed files to the same repository; the site updates by itself within a couple of minutes.

The files must sit at the top of the repository (not inside another folder), with `index.html` among them.

## Install it like an app

- **iPhone or iPad (Safari):** open your link, tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** open your link, tap the menu, then **Install app** or **Add to Home screen**.
- **Computer (Chrome or Edge):** open your link and click the install icon in the address bar.

After the first visit, pages you have opened also work without internet. Recitation audio needs internet.

## Where your data is kept

Everything you save (students, drawings, highlights, bookmarks, notes, lessons) stays **in the browser on the device you use**. Nothing is uploaded anywhere. This means:

- The same link on another device starts empty. To move your work, open **Settings, Download backup** on the old device, then **Restore backup** on the new one.
- Clearing your browser's site data erases it. Download a backup now and then.
- Drawings line up best on the device they were made on, because they follow the exact position of the words on the page.
- Each script view (Uthmani, Uthmani with tajweed colours, IndoPak) keeps its own drawings, because the words sit in different places. Highlights, bookmarks and notes are shared. Mistakes marked in the IndoPak view are kept apart, because the two scripts can split words differently.

The Quran text, translations and recitations are downloaded from AlQuran Cloud while you use the app. Pages you open are kept on the device for offline use.

## Quick guide

| To do this | Do this |
| --- | --- |
| Choose a student | Tap the name at the top right. **Add student** gives them their own mushaf. |
| Go to a surah, juz or page | Tap the surah name at the top, or press `G`. |
| Turn pages | The arrows at the top, the arrows beside the page, a swipe, or the `←` `→` keys. Like a mushaf, `←` goes forward. |
| Draw, highlight, erase | Pick the tool on the left (at the bottom on a phone). Tap the same tool again to show or hide its colours and sizes. |
| Scroll while drawing on a touch screen | Use two fingers. With a stylus, the app switches so your finger scrolls and only the pen draws. |
| Recite, highlight, bookmark an ayah | Tap the ayah, then use the bar under the page. Tap **+** and then another ayah to select a range. |
| Open a bookmark | **Bookmarks** on the left, or press `B`. Tap a bookmark to jump to its page. |
| Tajweed colours | **Tajweed colours** on the left, or press `C`. The key is on the notebook's Tajweed tab. |
| IndoPak, Uthmani or your mushaf | The **Script** button on the left, or press `I`. Add your mushaf PDF in Settings first. |
| English and Urdu translation | **Translation** on the left. Choose the two translations in Settings. |
| Show or hide button names | **Hide labels** / **Show labels** at the top of the tool panel. |
| See a student's notebook | The notebook button at the top right, or press `N`. |
| Test memory | The eye button, or press `T`. |

## Make it your own

- **Name:** the name "Halaqa" appears in `index.html` (the `<title>` and the top bar), in `manifest.webmanifest`, and in `app.js` (`const APP`).
- **Colours:** the theme colours are at the top of `styles.css`.
- **Highlight colour names:** change them in the app under Settings.
- **Reciter and translation:** choose them in Settings.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page and its dialogs |
| `styles.css` | All the styling and the three themes |
| `app.js` | The main app: pages, tools, students, notebook, settings |
| `api.js` | Downloads Quran text, translations, audio links and search results |
| `ink.js` | Drawing, highlighting, erasing and the laser pointer |
| `cursor.js` | The custom cursor |
| `player.js` | Recitation with repeat and loop |
| `db.js` | Saves your data on the device |
| `ui.js` | Small helpers and the icon set |
| `tajweed.js` | The tajweed rules, their colour markup, and a fix that keeps coloured letters joined in Safari |
| `mushaf.js` | Reads a mushaf PDF on the device, stores its page pictures and shows them |
| `mushaf13.json` | Where every ayah, surah and juz is on the pages of the 13-line colour-coded tajweed mushaf |
| `sw.js`, `manifest.webmanifest` | Offline support and installing as an app |
| `icon*.png`, `icon.svg`, `apple-touch-icon.png` | App icons |

## Sources and credits

- Quran text: [Tanzil Project](https://tanzil.net), Uthmani script. Tanzil allows the text to be used in any website or application as long as it is shown unchanged and Tanzil is credited with a link. Halaqa shows it unchanged and credits Tanzil in its About box.
- Quran text, translations and search: [AlQuran Cloud API](https://alquran.cloud/api), free and without a key. Tajweed colours come from its `quran-tajweed` edition.
- IndoPak text: the `ara-quranindopak` edition of the open [Quran API](https://github.com/fawazahmed0/quran-api) by fawazahmed0, served by jsDelivr.
- Recitations: [Islamic Network CDN](https://alquran.cloud/cdn).
- Fonts: Amiri and Amiri Quran by Khaled Hosny, Lateef and Scheherazade New by SIL (IndoPak text), Noto Nastaliq Urdu (Urdu translation), and Instrument Sans, all under the SIL Open Font License, loaded from Google Fonts.

GitHub Pages is for personal, educational and open-source sites. It isn't meant to run a paid online business, so if you later charge for access to the app itself, look at a different host.
