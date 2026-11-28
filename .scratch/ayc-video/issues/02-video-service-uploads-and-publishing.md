# 02 — Video service, uploads and publishing

**What to build:** Staff upload each Lesson's video from the Lesson editor straight to VdoCipher, watch it in a preview, and publish the Lesson once the video is ready. The VdoCipher key decides whether this is real, as the PayMongo key does for payments (ADR 0013).

- **The video service** is one small interface with a real VdoCipher client and a fake, following the payments client and its fake. It:
  - gets one-time upload permission for a new video
  - reads a video's status (processing, ready, failed) and length
  - deletes a video
  - issues a playback pass carrying watermark text
- **The key decides** (server-only `VDOCIPHER_API_SECRET`, never `NEXT_PUBLIC_`; the user sets it):
  - **Sample mode and tests:** the fake. Uploads run a quick progress bar, then "Processing" for a few seconds, then ready with a made-up length.
  - **No key:** the Lesson editor says "Connect the video service to upload", with upload off.
  - **With the key:** real uploads.
  - Executers read VdoCipher's public docs only and never call VdoCipher.
- **Uploading** from the Lesson editor:
  - MP4 or MOV, up to 4 GB, checked before permission is asked.
  - Our server gives upload permission to Staff only, for that Lesson, and records the video on the Lesson. The browser then sends the file straight to VdoCipher; it never passes through our servers.
  - Progress: "41% · about 6 min left · keep this page open". The browser warns before leaving mid-upload.
  - Not resumable: on failure the Lesson shows "Upload failed · Try again", which starts over.
  - After the upload: "Processing". The editor asks the video service for the status every few seconds while it's open, then shows the video ready with its length (the Lesson becomes a draft).
  - **"Replace video":** a Published Lesson keeps playing its old video until the new one is ready; then the new one takes over and the old one is deleted from VdoCipher.
- **Publishing:**
  - Publish needs a title and a ready video ("ADD A TITLE BEFORE PUBLISHING", "ADD A VIDEO BEFORE PUBLISHING", "WAIT FOR THE VIDEO TO FINISH UPLOADING"). Unpublish returns a Lesson to draft.
  - A Course can be made Visible once it has a Published Lesson. Unpublishing the last Published Lesson of a Visible Course is refused: "A visible course needs a published lesson. Hide the course first."
  - Lesson states: no video, uploading, processing, draft, published, upload failed.
- **Deleting** a Lesson or a Course also deletes its videos from VdoCipher. A failed delete doesn't block the deletion; it's logged in Staff Activity.
- **The Staff preview:** the Lesson editor plays the real video (or the sample player), watermarked with the Staff member's email, without the device check (the Admin is exempt).
- **Security headers** allow VdoCipher's player to be embedded and the browser to send files to VdoCipher's upload host, and nothing else new.
- **The production runbook** gets a VdoCipher section for the user: open the account under the business's email, set the key in Vercel, buy Starter before uploading more than the trial's 4 videos.
- **Sample data:** the sample Lessons get ready (fake) videos and are Published, and the sample Courses become Visible.

**Blocked by:** 01.

**Status:** ready-for-agent

Spec: Phase 5 → "Phase 5 planning decisions" (The VdoCipher key decides, The video service interface, Uploads, Hiding, unpublishing and deleting, Access and playback: the Staff preview); ADR 0013; stories 156, 176, 177, 178, 187.

- [ ] In sample mode an Editor uploads an MP4 to a Lesson, sees the progress, then "Processing", then the ready video with its length, previews it and publishes the Lesson; then makes the Course Visible.
- [ ] "Replace video" keeps the old video playing until the new one is ready, then deletes the old one (seen in the fake).
- [ ] With no key, the editor shows "Connect the video service to upload" and upload is off; everything else in the builder works.
- [ ] The runbook has the VdoCipher section.
- [ ] **Sad paths, each with a test:**
  - a file that isn't MP4 or MOV, or is over 4 GB, is refused before any permission is asked
  - upload permission is refused on the server for non-Staff, and for a Lesson that doesn't exist
  - a failed upload shows "Upload failed · Try again" and the Lesson can't be published
  - publishing while uploading or processing is refused with "WAIT FOR THE VIDEO TO FINISH UPLOADING"
  - publishing without a title is refused with "ADD A TITLE BEFORE PUBLISHING"
  - unpublishing the last Published Lesson of a Visible Course is refused
  - deleting a Lesson deletes its video in the video service; a failed delete still deletes the Lesson and is logged
  - the key never reaches the browser (no `NEXT_PUBLIC_`, not in any client bundle or page)
  - the security headers allow VdoCipher's player frame and upload host, and no other new source
