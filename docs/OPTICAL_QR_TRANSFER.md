# ProMana Optical QR Image Transfer

ProMana can move a JPEG, PNG, WebP, or GIF image from a computer display to a
phone camera. The animated QR frames contain the file bytes themselves. The
transfer does not use an IP address, URL payload, Wi-Fi, hotspot, Bluetooth,
local HTTP server, cloud relay, Firebase, Google Drive, or Vercel API request.

The implementation is intentionally a reliable small-file transport, not a
replacement for a cable or nearby-share protocol. Use it when both devices can
display/scan QR codes and no data network is available.

## What changed

The former feature put a private-LAN HTTP URL in one QR code and required a
Node.js companion on a fixed local port. That server, its loopback control client,
network-interface picker, one-time URL sessions, temporary files, HTTP receiver,
firewall instructions, polling, and separate companion npm command have all
been removed.

The IndexedDB image cache remains. It is transport-independent and lets the
desktop prepare a previously cached Drive image while disconnected. Its database
name remains `promana-offline-transfer` so existing cached images are not lost.

## Architecture and data flow

```text
Google Drive (only for an uncached first preparation)
             |
             v
Desktop IndexedDB image cache
             |
             v
original Blob -> Uint8Array -> MIME/magic validation -> SHA-256
             |
             v
600-byte source chunks -> compact PMOT V1 binary packets -> Base64URL at QR edge
             |
             v
animated QR on desktop display  ===== optical light =====>  phone rear camera
                                                            |
                                                            v
                                                    bundled jsQR worker
                                                            |
                                                            v
                                              parse + CRC + session filter
                                                            |
                                                            v
                                            deduplicate/out-of-order collector
                                                            |
                                                            v
                                          exact length + magic + SHA-256 verify
                                                            |
                                                            v
                                                  preview -> local download
```

The sender is one-way. It can report only its current frame and broadcast cycle.
It cannot know which chunks the phone has decoded. Only the receiver displays
real `unique chunks / total chunks` progress and declares completion.

## PMOT V1 protocol

Every packet uses a compact binary header:

| Offset | Bytes | Field |
| ---: | ---: | --- |
| 0 | 4 | ASCII magic `PMOT` |
| 4 | 1 | protocol version `1` |
| 5 | 1 | packet type: metadata, data, or end |
| 6 | 1 | flags; low nibble reserves an FEC scheme (`0` in V1) |
| 7 | 1 | reserved, must be zero |
| 8 | 16 | cryptographically random 128-bit session ID |
| 24 | variable | type-specific binary payload |
| final 4 | 4 | CRC-32 of the header and payload |

Metadata packets contain the original byte size, chunk size, source-chunk count,
MIME code, UTF-8 filename length, 32-byte SHA-256 digest, and sanitized filename.
Data packets contain a 32-bit chunk index, 16-bit payload length, and raw source
bytes. End packets mark a completed sender cycle but do not let the receiver skip
missing data or integrity verification.

At the final QR boundary only, a packet is encoded as unpadded Base64URL text
with the prefix `PMOT1:`. No source bytes are converted to hexadecimal, binary
text, per-frame JSON, or a URL.

V1 defaults are:

- 600 raw source bytes per data frame (configurable from 128 through 1,200).
- 8 frames per second.
- QR error correction level M.
- Repeated metadata after every 12 data frames.
- One end packet at the end of a full cycle.
- Continuous looping until the user pauses or closes the sender.
- Numbered chunks with deduplication and out-of-order reconstruction; no FEC in
  V1.
- A 10 MiB maximum original file size.

The 16-byte session ID comes from `crypto.getRandomValues`, not `Math.random`.
The receiver locks onto the first valid metadata session and ignores frames from
other sessions. Starting in the middle is supported: data frames can arrive
before metadata, metadata repeats, and all frames return on later cycles.

## Sender behavior

In Docs & Images, choose the QR action on an image. ProMana first checks the
cached copy. If it is not cached, one connected preparation retrieves it from
Google Drive and stores a browser copy when storage is available.

The sender then:

1. reads the exact Blob bytes locally;
2. enforces size, MIME, and image-signature rules;
3. sanitizes the filename;
4. calculates SHA-256;
5. builds PMOT V1 metadata, data, and end packets;
6. displays animated QR frames after **Start broadcast** is pressed;
7. repeats the cycle until paused or closed.

The sender shows the file, SHA-256 digest, chunk count, current frame/cycle,
ideal first-cycle estimate, full-screen control, and a large-transfer warning.
It requests a Screen Wake Lock while broadcasting when the browser supports it.
If the request fails, keep the display awake manually. Increase display
brightness enough for the phone camera but avoid glare.

## Receiver behavior

`/receiver` is a public route and does not require ProMana authentication. Tap
**Start camera** to request the rear camera. Pixel frames are cropped/downscaled
and sent to a bundled module worker; `jsQR` decodes them locally at a target scan
interval of 125 ms.

The receiver validates untrusted QR input before accepting it. It handles
permission denial, an unavailable or busy camera, malformed QR content,
unsupported protocol versions, corrupt CRCs, duplicates, out-of-order chunks,
mixed sessions, invalid lengths/counts, oversized files, unsupported MIME types,
filename hazards, and image-signature mismatches.

After every source chunk exists, the receiver reconstructs bytes in order and
requires all of these before success:

- reconstructed length exactly equals metadata length;
- bytes match the declared JPEG/PNG/WebP/GIF signature;
- computed SHA-256 exactly equals the metadata digest.

Only then does it create a local Blob, show a preview, and enable **Save image**.
The Android browser chooses the download location; automatic Gallery placement
varies by browser.

## Installing the offline receiver

Camera access requires a secure context, so use the Vercel HTTPS deployment (or
localhost during development). Before going offline on the phone:

1. Visit `https://YOUR-STABLE-DOMAIN/receiver` online.
2. Wait for the complete production build to load.
3. Install ProMana from Chrome/Edge's app menu. Installation is recommended;
   reopening the same route in the same browser profile can also work.
4. Reload once and confirm the installed receiver opens.
5. Allow camera permission when starting the receiver, or grant it later in site
   settings.

The generated service worker precaches the receiver component, protocol code,
CSS, icons, the locally bundled decoder, and its worker. After that preparation,
the phone may enter airplane mode and launch the installed receiver. A first
offline visit cannot download an application that was never cached. Do not clear
site data, use a new Vercel preview URL, or switch browser profiles before the
offline transfer.

There is no extra Firebase, Google AI Studio, Google Drive, or Vercel service to
enable. Deploy the production build to one stable HTTPS origin. Development mode
does not register the service worker; use `npm run build` plus `npm run preview`
or a deployment to test an offline reload.

## Security and privacy

- No transfer bytes or transfer metadata are uploaded by this feature.
- No hidden network or cloud fallback exists.
- CRC-32 rejects damaged individual frames; it is not a cryptographic check.
- SHA-256 detects incomplete or corrupted reconstruction before download.
- The random session ID prevents accidental mixing; it is not authentication or
  encryption.
- Anyone who can record enough visible QR frames can reconstruct the image. Use
  the sender away from untrusted cameras and shoulder surfers.
- Do not put confidential images on a screen visible to others. PMOT V1 provides
  integrity, not confidentiality.
- Receiver allocations are bounded by the 10 MiB limit and declared packet
  lengths/counts are checked before use.
- Only JPEG, PNG, WebP, and GIF declarations with matching file signatures are
  accepted.
- Object URLs are revoked when restarting or leaving the receiver.

The decoder is pinned to `jsqr@1.4.0`. It is Apache-2.0 licensed, has no runtime
dependencies, accepts raw RGBA pixels, and is bundled locally. The tradeoff is
that its latest published release is old; keep it pinned, include it in dependency
audits, and reevaluate maintained offline decoders during protocol upgrades.
`qrcode.react` remains the bundled sender renderer.

## Performance and memory

At 600 bytes and 8 FPS, the absolute source-data ceiling during uninterrupted
data frames is 4,800 bytes/s. Repeated metadata and the end marker reduce the
ideal sustained first-cycle rate to roughly 4.4 KB/s for larger files. Base64URL
increases QR density but does not create another in-memory copy of the original
file for every frame. Camera misses and subsequent loop recovery make physical
transfers slower.

Approximate ideal first-cycle times with defaults:

| Original size | Ideal time (approximately) |
| ---: | ---: |
| 100 KiB | 24 seconds |
| 1 MiB | 4 minutes |
| 5 MiB | 20 minutes |
| 10 MiB maximum | 40 minutes |

These are calculations, not measured laptop-to-Android results. Real throughput
depends on camera focus, exposure, refresh timing, display resolution/brightness,
glare, distance, browser scheduling, and QR decode success. For ordinary use,
prefer screenshots and compressed images below roughly 1 MiB.

The sender holds the original bytes plus serialized packets; the receiver holds
accepted chunks and creates another contiguous byte array during verification.
Near the 10 MiB limit, allow several tens of MiB of temporary browser memory.
The limit bounds memory pressure but does not make a 10 MiB optical transfer fast.

## Automated validation

Run:

```bash
npm run test:optical-transfer
npm test
npm run lint
npm run build
```

Protocol tests cover packet round trips, CRC rejection, SHA-256 and exact-byte
verification, invalid metadata and file signatures, unsupported versions,
duplicates, out-of-order delivery, receiver start in the middle of a cycle,
mixed sessions, metadata repetition, and simulated 10%/20% frame loss followed
by later loop recovery.

## Manual laptop-to-Android acceptance test

This requires physical hardware and must not be replaced with a simulated claim:

1. Deploy the latest build on a stable HTTPS domain.
2. On Android Chrome, visit `/receiver`, install ProMana, reload, and allow the
   camera once.
3. On the desktop, upload/cache three known images: about 100 KiB, 500 KiB, and
   1 MiB. Record each original size and SHA-256.
4. Disconnect both devices from every network or enable airplane mode. Keep the
   already-loaded desktop app open and launch the installed phone receiver.
5. Start an optical transfer, start the phone camera, fill most of the guide with
   the desktop QR, and keep both devices steady.
6. Confirm receiver progress counts only unique chunks and survives temporarily
   blocking the camera, moving out of frame, and starting after the sender has
   already completed part of a cycle.
7. Wait for the verified preview, save it, and compare its byte length and
   SHA-256 to the original. On Windows, `Get-FileHash FILE -Algorithm SHA256`
   can produce the desktop reference.
8. Repeat in bright/dim light, at different distances, and with battery saver on
   and off. Record time, device/browser versions, missed-frame recovery, and any
   focus failures.
9. Try a deliberately unsupported or oversized file and confirm it is rejected
   before broadcasting/downloading.

## Known V1 limitations and V2 direction

- V1 has no forward-error correction. Dropped frames are recovered by looping,
  which can make the final few chunks slow.
- The one-way sender cannot receive acknowledgements or show phone progress.
- Transfer speed is intentionally conservative and unsuitable for large photos.
- Screen capture is observable; frames are not encrypted.
- Browser download UX and camera behavior vary by Android vendor/browser.

The packet flags reserve an FEC identifier and the protocol is versioned for a
future V2. Candidates include fountain/Raptor-style repair symbols, interleaving,
adaptive chunk density/FPS, an optional receiver-to-sender visual acknowledgement
channel, encrypted sessions established by a short setup code, resume-state
persistence, and empirical device profiles. V2 receivers must continue to reject
unknown versions cleanly rather than guessing their format.
