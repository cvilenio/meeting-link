// Records a meeting-guard button click in ntfy, then opens the meeting.
//
// Everything this page needs arrives in the URL fragment, which browsers never
// send to the server hosting the page:
//   #a=join|skip|rsvp&id=<ack id>&t=<ack topic>[&u=<url>]
//
//   join  record, then open the meeting link (record only if there is no link)
//   skip  record only
//   rsvp  record, then open the event in Google Calendar to respond
//
// Safety rules:
//   - only POSTs to https://ntfy.sh, and only `<action>:<id>`
//   - only redirects over https to known meeting hosts (join) or Google
//     Calendar (rsvp), or to zoommtg: for Zoom on desktop
//   - never writes fragment values into HTML

"use strict";

const NTFY = "https://ntfy.sh";
const ACTIONS = ["join", "skip", "rsvp"];
const MEETING_HOSTS = [/(^|\.)zoom\.us$/, /^meet\.google\.com$/, /^teams\.microsoft\.com$/, /^teams\.live\.com$/];
const CALENDAR_HOSTS = [/^calendar\.google\.com$/, /^www\.google\.com$/];
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const POST_TIMEOUT_MS = 4000;

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const continueEl = document.getElementById("continue");

function show(status, detail = "") {
  statusEl.textContent = status;
  detailEl.textContent = detail;
}

function safeUrl(raw, hosts) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !hosts.some((re) => re.test(url.hostname))) return null;
  // www.google.com is allowed only for Calendar event pages.
  if (url.hostname === "www.google.com" && !url.pathname.startsWith("/calendar/")) return null;
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
  const rawUrl = params.get("u");
  if (!ACTIONS.includes(action) || !TOKEN_RE.test(id || "") || !TOKEN_RE.test(topic || "")) {
    show("Nothing to do here.");
    return;
  }

  let target = null;
  if (action === "join" && rawUrl) target = safeUrl(rawUrl, MEETING_HOSTS);
  if (action === "rsvp") target = safeUrl(rawUrl || "", CALENDAR_HOSTS);
  if (((action === "join" && rawUrl) || action === "rsvp") && !target) {
    show("Invalid link.", "Nothing was recorded. Open the meeting from your calendar.");
    return;
  }

  const recorded = await record(topic, action, id);
  const failed = "Could not reach ntfy, so escalation continues.";

  if (!target) {
    const done = action === "join" ? "Joined" : "Skipped";
    show(recorded ? done : "Not recorded", recorded ? "You can close this tab." : failed);
    return;
  }

  const href = action === "join" ? launchUrl(target) : target.href;
  const opening = action === "join" ? "Opening the meeting..." : "Opening Google Calendar...";
  if (recorded) {
    show(action === "join" ? "Joined" : "Respond in Calendar", opening);
  } else {
    show("Not recorded", `${failed} ${opening}`);
  }
  continueEl.textContent = action === "join" ? "Open the meeting" : "Open Google Calendar";
  continueEl.href = href;
  continueEl.hidden = false;
  location.replace(href);
}

main();
