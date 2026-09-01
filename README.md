# Monolith NFT Gallery

An interactive first-person 3D gallery concept for the 1,000 NFTs reserved through [Standard Reserve](https://www.standardreserve.xyz/app/mint/).

The experience begins on an open skybridge connecting two monumental towers. Each tower contains five gallery floors with 100 reserved NFT frames per floor, creating 1,000 exhibition spaces in total. The frames currently display **COMING SOON** while the collection and its owners remain anonymous.

## Experience

- First-person exploration with camera-relative movement
- Two connected towers with five gallery floors each
- 1,000 evenly arranged NFT exhibition frames
- Separate stair routes with railings and collision-aware movement
- Open observation bridge and surrounding procedural city
- Interactive NFT information panel opened with the `E` key
- No wallet connection or authentication

## Controls

| Key | Action |
| --- | --- |
| `W` | Move forward |
| `A` | Move left |
| `S` | Move backward |
| `D` | Move right |
| Mouse | Look around |
| `Shift` | Walk faster |
| `E` | Inspect an NFT frame |
| `Esc` | Pause |

## Technology

- Next.js App Router
- React
- TypeScript
- Three.js
- Tailwind CSS
- Vercel

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a desktop browser.

## Production build

```bash
npm run build
npm run start
```

## Project status

This is an independent concept prototype. The NFT artwork, ownership data, traits, marketplace information, and custom 3D owner profiles will be added when official collection data becomes available.

This repository is not an official Standard Reserve product and does not request wallet access.
