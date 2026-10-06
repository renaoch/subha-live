// Local generator for believable fictional opponents: a name plus a portrait
// "spec" that <PortraitAvatar> renders as an illustrated headshot. Nothing here
// touches the network or any real user data.

import { pick, randInt, shuffleInPlace, type Rng } from "./rng";

export type Presentation = "f" | "m";

export type HairStyle =
  | "long" | "bob" | "bun" | "wavy" | "sideBangs" // feminine
  | "short" | "quiff" | "sidePart" | "curly" | "buzz"; // masculine

export type Outfit = "tee" | "collar" | "hoodie" | "blazer" | "kurta" | "dress";
export type Accessory = "none" | "glasses" | "sunglasses";

export interface PortraitSpec {
  presentation: Presentation;
  skin: number; // index into SKIN_TONES
  hairColor: number; // index into HAIR_COLORS
  hairStyle: HairStyle;
  outfit: Outfit;
  outfitColor: number; // index into OUTFIT_COLORS
  accessory: Accessory;
  beard: "none" | "stubble" | "full" | "moustache";
  earrings: boolean;
  background: number; // index into BACKGROUNDS
  /** Small per-portrait variation so two similar specs still differ subtly. */
  eyeColor: number;
  smile: number; // 0..2
}

export interface OpponentProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  portrait: PortraitSpec;
}

export const SKIN_TONES = ["#F7D6B8", "#EDBE98", "#D9A074", "#BC7C52", "#94593A", "#6A3F27"] as const;
export const HAIR_COLORS = ["#16110F", "#2A1A12", "#47291A", "#6B4426", "#8E6B3E", "#B58847", "#8A8D93", "#7A2D1B"] as const;
export const OUTFIT_COLORS = ["#1F2A44", "#7A1F2B", "#1E5A4B", "#3B2A66", "#B8863A", "#2B2F36", "#8A3B5E", "#2F6A8F", "#C9C2B2", "#5A3A22"] as const;
export const BACKGROUNDS = [
  ["#5B3A7A", "#241236"],
  ["#2F5E7A", "#10243A"],
  ["#7A4A2A", "#2E170C"],
  ["#2D6A5C", "#0F2A25"],
  ["#7A2F4B", "#2E0F1D"],
  ["#4B4F8F", "#161A3A"],
] as const;
export const EYE_COLORS = ["#2B1A10", "#3A2414", "#1D2B3A", "#2E4A32"] as const;

const FEMININE_HAIR: HairStyle[] = ["long", "bob", "bun", "wavy", "sideBangs"];
const MASCULINE_HAIR: HairStyle[] = ["short", "quiff", "sidePart", "curly", "buzz"];

const FIRST_F = [
  "Aanya", "Zara", "Riya", "Myra", "Ananya", "Diya", "Ishita", "Kavya", "Meera", "Naina", "Sanya", "Tara",
  "Anika", "Kiara", "Prisha", "Saanvi", "Aditi", "Neha", "Pooja", "Simran", "Mehak", "Ira", "Sara", "Alia",
  "Rhea", "Tanvi", "Avni", "Nisha", "Esha", "Samaira", "Trisha", "Mahika", "Jhanvi", "Laila", "Sneha", "Divya",
];
const FIRST_M = [
  "Kabir", "Dev", "Armaan", "Vihaan", "Aarav", "Rohan", "Arjun", "Ishaan", "Rahul", "Karan", "Aditya", "Neil",
  "Yash", "Veer", "Samar", "Ayaan", "Nikhil", "Rehan", "Zayn", "Tanish", "Aryan", "Rudra", "Dhruv", "Manav",
  "Sahil", "Kunal", "Farhan", "Imran", "Parth", "Ritvik", "Vivaan", "Reyansh", "Jai", "Omkar", "Danish", "Harsh",
];
const SURNAMES = [
  "Mehta", "Sharma", "Khan", "Malhotra", "Roy", "Kapoor", "Das", "Sen", "Verma", "Gupta", "Singh", "Iyer",
  "Nair", "Reddy", "Bose", "Chopra", "Joshi", "Patel", "Shah", "Bhatia", "Ahuja", "Saxena", "Banerjee",
  "Chatterjee", "Menon", "Pillai", "Desai", "Kulkarni", "Rao", "Sethi", "Arora", "Khanna", "Ghosh", "Mukherjee",
  "Tandon", "Oberoi", "Walia", "Sinha", "Mishra", "Pandey", "Siddiqui", "Qureshi", "Ansari", "Dutta", "Lal",
  "Bajaj", "Anand", "Thakur",
];

export const OPPONENT_COUNT = 4;

function makePortrait(rng: Rng, presentation: Presentation): PortraitSpec {
  const feminine = presentation === "f";
  const outfitPool: Outfit[] = feminine ? ["dress", "blazer", "collar", "tee", "kurta"] : ["tee", "collar", "hoodie", "blazer", "kurta"];
  let beard: PortraitSpec["beard"] = "none";
  if (!feminine) beard = pick(rng, ["none", "none", "stubble", "full", "moustache"] as const);
  return {
    presentation,
    skin: randInt(rng, SKIN_TONES.length),
    // Index 6 is grey: only offered for men, so younger-looking women keep natural tones.
    hairColor: feminine ? randInt(rng, HAIR_COLORS.length - 2) : randInt(rng, HAIR_COLORS.length),
    hairStyle: pick(rng, feminine ? FEMININE_HAIR : MASCULINE_HAIR),
    outfit: pick(rng, outfitPool),
    outfitColor: randInt(rng, OUTFIT_COLORS.length),
    accessory: pick(rng, ["none", "none", "none", "glasses", "sunglasses"] as const),
    beard,
    earrings: feminine ? rng() < 0.6 : false,
    background: randInt(rng, BACKGROUNDS.length),
    eyeColor: randInt(rng, EYE_COLORS.length),
    smile: randInt(rng, 3),
  };
}

/** Two portraits that would look like the same person to a player. */
function looksSame(a: PortraitSpec, b: PortraitSpec): boolean {
  if (a.presentation !== b.presentation) return false;
  const sameLook = a.hairStyle === b.hairStyle && a.hairColor === b.hairColor;
  const sameSkin = a.skin === b.skin;
  const sameOutfit = a.outfit === b.outfit && a.outfitColor === b.outfitColor;
  return (sameLook && sameSkin) || (sameSkin && sameOutfit) || (a.skin === b.skin && a.background === b.background);
}

/**
 * Generates `count` opponents with unique full names, unique first names and
 * visibly different portraits. Mixed presentation (at least one of each).
 */
export function generateOpponents(rng: Rng, count = OPPONENT_COUNT, sessionTag = ""): OpponentProfile[] {
  const femaleCount = Math.max(1, Math.min(count - 1, 1 + randInt(rng, count - 1))) ; // 1..count-1
  const presentations: Presentation[] = shuffleInPlace(
    Array.from({ length: count }, (_, i) => (i < femaleCount ? "f" : "m") as Presentation),
    rng,
  );

  const profiles: OpponentProfile[] = [];
  const usedFirst = new Set<string>();
  const usedFull = new Set<string>();

  for (let i = 0; i < count; i++) {
    const presentation = presentations[i];
    const firstPool = presentation === "f" ? FIRST_F : FIRST_M;

    let firstName = pick(rng, firstPool);
    for (let guard = 0; usedFirst.has(firstName) && guard < 200; guard++) firstName = pick(rng, firstPool);
    let lastName = pick(rng, SURNAMES);
    for (let guard = 0; usedFull.has(`${firstName} ${lastName}`) && guard < 200; guard++) lastName = pick(rng, SURNAMES);

    let portrait = makePortrait(rng, presentation);
    for (let guard = 0; profiles.some((p) => looksSame(p.portrait, portrait)) && guard < 200; guard++) {
      portrait = makePortrait(rng, presentation);
    }

    usedFirst.add(firstName);
    usedFull.add(`${firstName} ${lastName}`);
    profiles.push({
      id: `${sessionTag}opp-${i}-${firstName}-${lastName}`.toLowerCase(),
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      portrait,
    });
  }
  return profiles;
}

/** Portrait for the human player (used only for the "You" seat). */
export function youPortrait(): PortraitSpec {
  return {
    presentation: "f",
    skin: 2,
    hairColor: 1,
    hairStyle: "long",
    outfit: "dress",
    outfitColor: 1,
    accessory: "none",
    beard: "none",
    earrings: true,
    background: 0,
    eyeColor: 1,
    smile: 1,
  };
}