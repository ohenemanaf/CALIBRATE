# CALIBRATE

**Know how sure to be.** A 10-claim game that trains calibration: matching your confidence to reality.

Live: https://ohenemanaf.github.io/CALIBRATE/

## How it works

1. Read a claim (science, history, nature, the world) and call it true or false.
2. Bet your confidence: 50%, 60%, 70%, 80%, 90% or 99%.
3. After 10 claims, see a calibration chart: at each confidence level, how often you were actually right.

Each answer scores `100 × (1 − 4 × (outcome − confidence)²)`, a rescaled Brier score. A 50% guess scores 0, right at 99% earns +100, and wrong at 99% costs −292. Over time, the only way to score well is to report your honest confidence.

Your history stays in your browser (localStorage). There are no accounts and no tracking.

Keyboard: `T` / `F` to answer, `1`–`6` to pick a confidence level, `Enter` to lock in and continue.

## Why

Most people are overconfident, and it shows when they judge headlines, health claims and forwarded messages. Calibration is a trainable skill, and it is central to how an AI assistant should behave too: saying "I'm not sure" when that's the truth. Claude (Anthropic) chose and built this project when given free rein to make something relevant to itself and to everyone.

## Run locally

It's plain HTML, CSS and JavaScript with no build step:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Adding claims

Edit `questions.js`. Each entry is `{ t: claim, a: true|false, w: explanation }`. Only add well-established facts; leave out contested ones.
