// Records a meeting-guard button click in ntfy, then opens the meeting.
//
// Everything this page needs arrives in the URL fragment, which browsers never
// send to the server hosting the page:
//   #a=join|skip&id=<ack id>&t=<ack topic>[&u=<meeting url>]
//
// Safety rules:
//   - only POSTs to https://ntfy.sh, and only `<action>:<id>`
//   - only redirects to known meeting hosts over https (or zoommtg: for Zoom)
//   - never writes fragment values into HTML

"use strict";

const NTFY = "https://ntfy.sh";
const ACTIONS = { join: "Joined", skip: "Skipped" };
const MEETING_HOSTS = [/(^|\.)zoom\.us$/, /^meet\.google\.com$/, /^teams\.microsoft\.com$/, /^teams\.live\.com$/];
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const POST_TIMEOUT_MS = 4000;

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const continueEl = document.getElementById("continue");

function show(status, detail = "") {
  statusEl.textContent = status;
  detailEl.textContent = detail;
}

function meetingUrl(raw) {
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !MEETING_HOSTS.some((re) => re.test(url.hostname))) return null;
  return url;
}

// On a desktop, open Zoom links straight in the app instead of the launcher page.
function launchUrl(url) {
  const mobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const match = url.pathname.match(/^\/j\/(\d+)/);
  if (mobile || !/(^|\.)zoom\.us$/.test(url.hostname) || !match) return url.href;
  const params = new URLSearchParams({ confno: match[1] });
  const pwd = url.searchParams.get("pwd");
  if (pwd) params.set("pwd", pwd);
  return `zoommtg://zoom.us/join?${params}`;
}

async function record(topic, action, id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${NTFY}/${topic}`, {
      method: "POST",
      body: `${action}:${id}`,
      signal: controller.signal,
    });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const params = new URLSearchParams(location.hash.slice(1));
  // Drop the fragment from the address bar and history entry.
  history.replaceState(null, "", location.pathname);

  const action = params.get("a");
  const id = params.get("id");
  const topic = params.get("t");
  if (!(action in ACTIONS) || !TOKEN_RE.test(id || "") || !TOKEN_RE.test(topic || "")) {
    show("Nothing to do here.");
    return;
  }

  const target = action === "join" ? meetingUrl(params.get("u")) : null;
  if (action === "join" && !target) {
    show("Invalid meeting link.", "Nothing was recorded. Open the meeting from your calendar.");
    return;
  }

  const recorded = await record(topic, action, id);

  if (action === "skip") {
    show(recorded ? "Skipped" : "Not recorded", recorded ? "You can close this tab." : "Could not reach ntfy. Escalation continues.");
    return;
  }

  const href = launchUrl(target);
  if (recorded) {
    show("Joined", "Opening the meeting...");
  } else {
    show("Not recorded", "Could not reach ntfy, so escalation continues. Opening the meeting anyway.");
  }
  continueEl.href = href;
  continueEl.hidden = false;
  location.replace(href);
}

main();
