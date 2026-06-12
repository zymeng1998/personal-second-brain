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

typeFilter.addEventListener("change", loadNotes);
void loadNotes();
void loadFacts();
