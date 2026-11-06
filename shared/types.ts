import type { Character } from "./character.js";
import type { TreeProgress } from "./trees.js";
export type Die =
  | "boost"
  | "setback"
  | "ability"
  | "difficulty"
  | "proficiency"
  | "challenge"
  | "force";
export type Pool = Partial<Record<Die, number>>;
export type Symbols = {
  success: number;
  failure: number;
  advantage: number;
  threat: number;
  triumph: number;
  despair: number;
  light: number;
  dark: number;
};
export type Roll = {
  faces: { die: Die; face: number; symbols: Symbols }[];
  net: Symbols;
};
export type Member = {
  userId: string;
  name: string;
  color: string;
  role: "gm" | "player";
  portrait?: string;
  art: string[];
  trees?: TreeProgress;
  character?: Character;
};
export type Grid = {
  type: "none" | "square" | "hex";
  size: number;
  offsetX: number;
  offsetY: number;
  color: string;
  snap: boolean;
};
export type Point = { x: number; y: number };
export type Fog = { id: string; erase: boolean; size: number; points: Point[] };
export type MapScene = {
  id: string;
  name: string;
  assetId?: string;
  width: number;
  height: number;
  grid: Grid;
  fog: Fog[];
  fogRevision?: string;
  hasImage?: boolean;
};
export type Sheet = {
  wounds: number;
  woundThreshold: number;
  strain: number;
  strainThreshold: number;
  soak: number;
  defense: number;
  credits: number;
  notes: string;
};
export type TokenAppearanceStyle = {
  background: string;
  textColor: string;
  outlineColor: string;
  outlineWidth: number;
  shape: "circle" | "square";
  imageFit: "cover" | "contain";
  /** Image zoom (1 = fit) and offset as a fraction of the token radius, for the front and back faces. */
  imageScale?: number;
  imageX?: number;
  imageY?: number;
  backImageScale?: number;
  backImageX?: number;
  backImageY?: number;
};
export type Token = {
  appearance?: TokenAppearanceStyle;
  id: string;
  mapId: string;
  ownerId: string;
  name: string;
  assetId?: string;
  /** Image shown on the other side when the token is flipped; the front image is reused if there is none. */
  backAssetId?: string;
  flipped?: boolean;
  x: number;
  y: number;
  size: number;
  rotation: number;
  status: string;
  hidden: boolean;
  z: number;
  sheet: Sheet;
};
export type Asset = {
  id: string;
  ownerId: string;
  kind: "map" | "token" | "art" | "handout";
  name: string;
  width: number;
  height: number;
};
export type Message = {
  id: string;
  userId: string;
  name: string;
  text: string;
  time: number;
  to?: string;
  roll?: Roll;
  /** What was rolled, e.g. a skill name. */
  label?: string;
  /** GM-only roll hidden from players. */
  secret?: boolean;
};
export type Slot = {
  id: string;
  type: "PC" | "NPC";
  success: number;
  advantage: number;
  used: boolean;
  name?: string;
  tokenId?: string;
  /** GM has hidden this combatant: players see a masked slot. */
  hidden?: boolean;
};
export type Campaign = {
  id: string;
  name: string;
  invite: string;
  revision: number;
  activeMapId: string;
  maps: MapScene[];
  tokens: Token[];
  assets: Asset[];
  members: Member[];
  messages: Message[];
  destiny: { light: number; dark: number };
  initiative: { round: number; slots: Slot[] };
  handout?: { id: string; assetId: string; title: string };
};
export const defaultSheet = (): Sheet => ({
  wounds: 0,
  woundThreshold: 12,
  strain: 0,
  strainThreshold: 12,
  soak: 0,
  defense: 0,
  credits: 0,
  notes: "",
});
