# Sanskrit Speech Lab

Pronunciation assessment (MFCC + spectral features + DTW) and Bhagavad Gita shloka recognition (MFCC + HMM). Pure HTML/CSS/JavaScript, no backend, no install.

## Run locally (VS Code)
1. Open this folder in VS Code.
2. Open a terminal in the folder and run: `python -m http.server 8000`
3. Open http://localhost:8000 in Chrome or Edge and allow the microphone when asked.

(Alternative: install the Live Server extension, right-click index.html, Open with Live Server.)

## Publish as a real website
- Netlify: go to app.netlify.com/drop and drag this folder in. You get an https link instantly.
- GitHub Pages: push the folder to a repo, then Settings > Pages > deploy from main branch.

## Why recording needs http://localhost or https
Browsers block microphone access on insecure or embedded pages. Local server or hosting fixes it.

## Files
index.html (layout), style.css (theme), app.js (feature extraction, DTW, HMM, UI).

## Suggested report structure
Title: Sanskrit Pronunciation Assessment Using MFCC and Spectral Features; HMM-Based Recognition of Bhagavad Gita Shlokas Using MFCC Features.
Method: see the About tab. Results: similarity scores for correct vs mispronounced attempts, and the leave-one-out accuracy table from the Verse tab.
