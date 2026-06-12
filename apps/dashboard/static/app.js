// Dashboard read view (SB-081). Plain ES module, no build step, no framework.
// Talks only to the same-origin JSON API; every API call is enforced
// server-side under surface:dashboard.

const noteList = document.getElementById("note-list");
const noteView = document.getElementById("note-view");
const factList = document.getElementById("fact-list");
const typeFilter = document.getElementById("type-filter");

async function getJson(path) {
  const res = await fetch(path);
  const body = await res.json().catch(() => null);
  if (!res.ok || body === null) {
    const code = body?.error?.code ?? `http_${res.status}`;
    throw new Error(code);
  }
  return body;
}

function li(html, className) {
  const item = document.createElement("li");
  if (className) item.className = className;
  item.append(html);
  return item;
}

async function loadNotes() {
  noteList.textContent = "";
  try {
    const query = typeFilter.value ? `?type=${encodeURIComponent(typeFilter.value)}` : "";
    const { notes } = await getJson(`/api/notes${query}`);
    if (notes.length === 0) {
      noteList.append(li("no notes yet — capture something", "error"));
      return;
    }
    for (const note of notes) {
      const item = document.createElement("li");
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = note.title ?? "(untitled)";
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${note.type ?? "?"} · ${note.id}`;
      item.append(title, meta);
      item.addEventListener("click", () => {
        for (const sibling of noteList.children) sibling.classList.remove("active");
        item.classList.add("active");
        loadNote(note.id);
      });
      noteList.append(item);
    }
  } catch (err) {
    noteList.append(li(`failed to load notes: ${err.message}`, "error"));
  }
}

async function loadNote(id) {
  noteView.textContent = "loading…";
  try {
    const { content } = await getJson(`/api/notes/${id}`);
    noteView.textContent = content;
  } catch (err) {
    noteView.textContent = `failed to load note: ${err.message}`;
  }
}

async function loadFacts() {
  factList.textContent = "";
  try {
    const result = await getJson("/api/facts");
    const facts = result.facts ?? [];
    if (facts.length === 0) {
      factList.append(li("no facts yet", "error"));
      return;
    }
    for (const fact of facts) {
      const item = document.createElement("li");
      const statement = document.createElement("span");
      statement.textContent = fact.statement ?? "";
      const conf = document.createElement("span");
      conf.className = "conf";
      conf.textContent = `confidence ${fact.confidence ?? "?"} · src ${fact.source_ref ?? "?"}`;
      item.append(statement, conf);
      factList.append(item);
    }
  } catch (err) {
    factList.append(li(`failed to load facts: ${err.message}`, "error"));
  }
}

// --- capture (SB-082): same-origin write guard ---------------------------
// The server hands this page a per-start nonce via /api/session; every
// mutating request echoes it back as X-SB-CSRF. Cross-site pages can never
// read the session response (no CORS), so they can never present the token.

const captureForm = document.getElementById("capture-form");
const captureStatus = document.getElementById("capture-status");
let csrfToken = null;

async function loadSession() {
  try {
    const { csrf } = await getJson("/api/session");
    csrfToken = csrf;
  } catch {
    captureStatus.textContent = "session unavailable — capture disabled";
    captureStatus.classList.add("error");
  }
}

captureForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  captureStatus.classList.remove("error");
  captureStatus.textContent = "capturing…";
  const content = document.getElementById("capture-content").value;
  const title = document.getElementById("capture-title").value.trim();
  try {
    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SB-CSRF": csrfToken ?? "" },
      body: JSON.stringify({ content, source: "paste", ...(title ? { title } : {}) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.code ?? `http_${res.status}`);
    captureStatus.textContent = `captured → ${body.note_id}`;
    captureForm.reset();
    void loadNotes();
  } catch (err) {
    captureStatus.textContent = `capture failed: ${err.message}`;
    captureStatus.classList.add("error");
  }
});

// --- review queue (SB-083): confirmation-gated front over the unchanged ---
// accept paths. The human pastes a REVIEWED proposal; the explicit button
// press (plus the review checkbox) is the confirmation. Nothing is
// generated or edited here; invalid proposals write nothing server-side.

const reviewForm = document.getElementById("review-form");
const reviewStatus = document.getElementById("review-status");
const candidateList = document.getElementById("candidate-list");

document.getElementById("load-candidates").addEventListener("click", async () => {
  candidateList.textContent = "";
  try {
    const result = await getJson("/api/distill/candidates");
    const candidates = result.candidates ?? [];
    if (candidates.length === 0) {
      candidateList.append(li("no L1 candidates — promote a raw note first", "error"));
      return;
    }
    for (const candidate of candidates) {
      const item = document.createElement("li");
      item.textContent = candidate.title ?? candidate.id;
      const meta = document.createElement("span");
      meta.className = "conf";
      meta.textContent = candidate.id;
      item.append(meta);
      candidateList.append(item);
    }
  } catch (err) {
    candidateList.append(li(`failed to load candidates: ${err.message}`, "error"));
  }
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = event.submitter?.dataset?.kind ?? "distill";
  reviewStatus.classList.remove("error");
  reviewStatus.textContent = "accepting…";
  try {
    const res = await fetch(`/api/${kind}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SB-CSRF": csrfToken ?? "" },
      body: document.getElementById("proposal-json").value,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.code ?? `http_${res.status}`);
    reviewStatus.textContent = `accepted (${kind})`;
    reviewForm.reset();
    void loadNotes();
    void loadFacts();
  } catch (err) {
    reviewStatus.textContent = `accept failed: ${err.message}`;
    reviewStatus.classList.add("error");
  }
});

typeFilter.addEventListener("change", loadNotes);
void loadSession();
void loadNotes();
void loadFacts();
