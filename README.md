# NoteFlow

A React and TypeScript note-taking app with a rich text editor, autosave, notebooks, tags, search, pinning, Archive, Trash, and version history.

**This repository's main app runs on GitHub Pages. Notes are stored in IndexedDB in each visitor's browser. It has no login, backend, or automatic device sync.** Your notes are not committed to GitHub. The public site and its source can be viewed by anyone, but it does not upload notes to a server. Browser storage is not encrypted by this app and should not be treated as a secure vault.

The `hosted-source/` folder also contains the original server-backed implementation for reference and further development. That edition uses ChatGPT sign-in, REST routes and D1 SQL. It cannot run on GitHub Pages and requires compatible server hosting and an authentication integration. No secrets, live notes, repository history, Site identity or account details are included.

## Put it on GitHub and publish

1. Extract the ZIP and open the **NoteFlow** folder. The `package.json`, `index.html`, `src/` and `.github/` folders must be at your repository root, not inside an extra NoteFlow subfolder.
2. Create a GitHub repository named **NoteFlow**, using `main` as its default branch. A public repository works with GitHub Free Pages.
3. Upload the entire contents of this folder, including `.github/workflows/pages.yml`. You can use GitHub Desktop or the terminal commands below. Do not upload `node_modules/`.
4. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Publish NoteFlow to GitHub Pages**. If the first run happened before Pages was enabled, choose **Run workflow**, select `main`, and run it again.
6. When the deployment succeeds, open the URL shown by GitHub Pages. It will usually be `https://YOUR-USERNAME.github.io/NoteFlow/`.

The workflow installs dependencies, runs the tests, builds the app and publishes it. Relative asset paths support a normal repository URL or a custom domain without changing Vite's base setting. No API keys or repository secrets are required.

### Upload from the VS Code terminal

Install Git, extract the ZIP, open the NoteFlow folder in VS Code, then replace YOUR-USERNAME in the remote URL:

```bash
git init
git add .
git commit -m "Add NoteFlow notes app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/NoteFlow.git
git push -u origin main
```

Create the empty remote repository first. If your remote repository already contains work, clone it and copy these files into it, then commit and push. Do not force-push or overwrite an existing project.

## Run and edit on Windows / VS Code

Use Node.js 24 and install the pinned package manager once:

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open the localhost URL shown in the terminal. Do not double-click `index.html`; it must be served by Vite or built and hosted.

```bash
pnpm test
pnpm build
pnpm preview
```

`pnpm build` creates the static production files in `dist/`. Commit source changes and push to `main`; the included workflow rebuilds and updates the site. `hosted-source/` is not part of the Pages build.

## Notes, backup and moving devices

- Your notes persist across ordinary reloads in the same browser and site path. A phone, another browser/profile, localhost, or a different Pages repository URL has separate storage.
- Clearing site data, private browsing limits, browser storage eviction or device loss can remove local notes. Use **Import & backup → Download backup** regularly.
- To move notes, download the JSON backup on the first device, transfer it to the other device, then use **Restore backup**. Restores add new copies and match notebooks/tags by name; they never overwrite existing notes. Importing the same backup twice creates duplicates.
- JSON backups include all notes (including Archive and Trash), rich content, tags and notebooks. Saved revision history is not included. Restore accepts up to 10 MB, 2,000 notes, 500 notebooks and 1,000 tags per file.
- You can restore JSON backups exported by the hosted NoteFlow app. To migrate, download that backup from the existing hosted app, then restore it in this Pages edition.
- Text and Markdown files can be imported as plain text notes. Markdown syntax is not converted into formatted text. A single note supports 100,000 characters.
- The most recent 50 saved content revisions can be restored. Permanent deletion removes both the note and its history.
- Draft recovery copies use localStorage and are scoped to the browser tab. After refreshing that same tab, recovered drafts require retry or conflict resolution before saving. Storage failures show an error and retain the draft in memory.
- This edition performs no note API calls. It can continue editing in an already open page without internet. It is not an installable PWA and opening a closed page offline is not guaranteed.
- Notes on two browser tabs use atomic IndexedDB transactions and revision checks. Return to the app or reopen a note to refresh saved changes.

## Project files

| Path | Purpose |
|---|---|
| `src/workspace.tsx` | Responsive workspace, editing, autosave, navigation and recovery |
| `src/editor.tsx` | Tiptap rich text editor |
| `src/local-api.ts` | Browser data operations and atomic IndexedDB persistence |
| `src/lib/document.ts` | Document validation and plain text extraction |
| `src/globals.css` | Desktop, mobile, dark theme and print styling |
| `tests/local-api.test.mjs` | Data-layer integration checks |
| `.github/workflows/pages.yml` | Test, build and deploy to GitHub Pages |
| `hosted-source/` | Original backend-based implementation; not deployed by Pages |

## Validation and limits

The browser data reducer passes 134 operations covering create/edit, search, tags, notebooks, conflicting revisions, atomic failures, Trash, revision retention, backup restoration and pagination. TypeScript checks and the Vite production build pass. Tests use transaction-style commit/rollback around the reducer. Actual IndexedDB browser persistence, browser UI interactions and real-phone behavior have not been exercised in this environment. The workflow is prepared but has not run in your GitHub account. A fresh network installation could not be tested here; installation on GitHub requires internet access. See VALIDATION.md for the full verification limits.

## Official publishing references

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://github.com/actions/setup-node
- https://github.com/pnpm/action-setup

## Original hosted source

The existing hosted app remains at its original address and is unchanged by this export. Its captured implementation is in `hosted-source/`; read that folder's README for architecture and local setup. The sanitized `.openai/hosting.json` contains storage binding names only. Publishing it as a new server-hosted app requires a new hosting identity and trusted authentication setup. Simply uploading the server source to Pages will not create a database or sign-in service.
