# meeting-link

Static page used by a personal meeting reminder tool.
A button in a private Slack channel opens this page; the page records the click in a private ntfy topic and then opens the meeting.

All inputs arrive in the URL fragment (`#...`), which browsers do not send to the server, so GitHub Pages never sees meeting links or topic names.
The page only posts to `https://ntfy.sh`, only redirects to Zoom, Google Meet, and Microsoft Teams hosts, and contains no credentials.

Source and deploy script live in a private repository; this repository is a published copy.
