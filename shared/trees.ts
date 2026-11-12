import {z} from "zod";

// Every tree is a reference image under public/ (Spec EoE, Spec FaD, Spec AoR and Spec ToR). Players tick talents on top of the image.
// Node numbering: specializations use 0-19 (row-major, 4 columns x 5 rows); careers use 0-17
// (signature ability 1 = node 0, its upgrades 1-8; signature ability 2 = node 9, its upgrades 10-17).
export type TreeKind = "career" | "specialization";
export type TreeMeta = { id: string; name: string; career: string; game: string; kind: TreeKind; nodes: number; image: string };
export const trees: readonly TreeMeta[] = [
  // Edge of the Empire
  {id:"eoe-bounty-hunter-career",name:"Bounty Hunter Career",career:"Bounty Hunter",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/1- Bounty Hunter Career.png"},
  {id:"eoe-assassin",name:"Assassin",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Assassin.png"},
  {id:"eoe-gadgeteer",name:"Gadgeteer",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Gadgeteer.png"},
  {id:"eoe-martial-artist",name:"Martial Artist",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Martial Artist.png"},
  {id:"eoe-operator",name:"Operator",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Operator.png"},
  {id:"eoe-skip-tracer",name:"Skip Tracer",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Skip Tracer.png"},
  {id:"eoe-survivalist",name:"Survivalist",career:"Bounty Hunter",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Bounty Hunter - Survivalist .png"},
  {id:"eoe-colonist-career",name:"Colonist Career",career:"Colonist",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/2 - Colonist Career.png"},
  {id:"eoe-doctor",name:"Doctor",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Doctor.png"},
  {id:"eoe-entrepreneur",name:"Entrepreneur",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Entrepreneur.png"},
  {id:"eoe-marshal",name:"Marshal",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Marshal.png"},
  {id:"eoe-performer",name:"Performer",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Performer.png"},
  {id:"eoe-politico",name:"Politico",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Politico.png"},
  {id:"eoe-scholar",name:"Scholar",career:"Colonist",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Colonist Scholar.png"},
  {id:"eoe-explorer-career",name:"Explorer Career",career:"Explorer",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/3 - Explorer Career.png"},
  {id:"eoe-archaeologist",name:"Archaeologist",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Archaeologist .png"},
  {id:"eoe-big-game-hunter",name:"Big-Game Hunter",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Big-Game Hunter.png"},
  {id:"eoe-driver",name:"Driver",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Driver.png"},
  {id:"eoe-fringer",name:"Fringer",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Fringer.png"},
  {id:"eoe-scout",name:"Scout",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Scout.png"},
  {id:"eoe-trader",name:"Trader",career:"Explorer",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Explorer Trader.png"},
  {id:"eoe-hired-gun-career",name:"Hired Gun Career",career:"Hired Gun",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/4 - Hired Gun Career.png"},
  {id:"eoe-bodyguard",name:"Bodyguard",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Bodyguard.png"},
  {id:"eoe-demolitionist",name:"Demolitionist",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Demolitionist.png"},
  {id:"eoe-enforcer",name:"Enforcer",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Enforcer.png"},
  {id:"eoe-heavy",name:"Heavy",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Heavy.png"},
  {id:"eoe-marauder",name:"Marauder",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Marauder.png"},
  {id:"eoe-mercenary-soldier",name:"Mercenary Soldier",career:"Hired Gun",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Hired Gun Mercenary Soldier.png"},
  {id:"eoe-smuggler-career",name:"Smuggler Career",career:"Smuggler",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/5 - Smuggler Career.png"},
  {id:"eoe-charmer",name:"Charmer",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Charmer.png"},
  {id:"eoe-gambler",name:"Gambler",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Gambler.png"},
  {id:"eoe-gunslinger",name:"Gunslinger",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Gunslinger.png"},
  {id:"eoe-pilot",name:"Pilot",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Pilot.png"},
  {id:"eoe-scoundrel",name:"Scoundrel",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Scoundrel.png"},
  {id:"eoe-thief",name:"Thief",career:"Smuggler",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Smuggler Thief.png"},
  {id:"eoe-technician-career",name:"Technician Career",career:"Technician",game:"Edge of the Empire",kind:"career",nodes:18,image:"/Spec EoE/6 - Technician Career.png"},
  {id:"eoe-cyber-tech",name:"Cyber Tech",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Cyber Tech.png"},
  {id:"eoe-droid-tech",name:"Droid Tech",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Droid Tech.png"},
  {id:"eoe-mechanic",name:"Mechanic",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Mechanic.png"},
  {id:"eoe-modder",name:"Modder",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Modder.png"},
  {id:"eoe-outlaw-tech",name:"Outlaw Tech",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Outlaw ttech.png"},
  {id:"eoe-slicer",name:"Slicer",career:"Technician",game:"Edge of the Empire",kind:"specialization",nodes:20,image:"/Spec EoE/Technician Slicer.png"},
  // Force and Destiny
  {id:"fnd-consular-career",name:"Consular Career",career:"Consular",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/1 - Consular Career .png"},
  {id:"fnd-arbiter",name:"Arbiter",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Arbiter.png"},
  {id:"fnd-ascetic",name:"Ascetic",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Ascetic.png"},
  {id:"fnd-healer",name:"Healer",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Healer.png"},
  {id:"fnd-niman-disciple",name:"Niman Disciple",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Niman Disciple.png"},
  {id:"fnd-sage",name:"Sage",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Sage.png"},
  {id:"fnd-teacher",name:"Teacher",career:"Consular",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Consular Teacher.png"},
  {id:"fnd-guardian-career",name:"Guardian Career",career:"Guardian",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/2 - Guardian Career.png"},
  {id:"fnd-armorer",name:"Armorer",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Armorer.png"},
  {id:"fnd-peacekeeper",name:"Peacekeeper",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Peacekeeper.png"},
  {id:"fnd-protector",name:"Protector",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Protector.png"},
  {id:"fnd-soresu-defender",name:"Soresu Defender",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Soresu Defender.png"},
  {id:"fnd-warden",name:"Warden",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Warden.png"},
  {id:"fnd-warleader",name:"Warleader",career:"Guardian",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Guardian Warleader.png"},
  {id:"fnd-mystic-career",name:"Mystic Career",career:"Mystic",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/3 - Mystic Career.png"},
  {id:"fnd-advisor",name:"Advisor",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Advisor.png"},
  {id:"fnd-alchemist",name:"Alchemist",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Alchemist.png"},
  {id:"fnd-magus",name:"Magus",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Magus.png"},
  {id:"fnd-makashi-duelist",name:"Makashi Duelist",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Makashi Duelist.png"},
  {id:"fnd-prophet",name:"Prophet",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Prophet.png"},
  {id:"fnd-seer",name:"Seer",career:"Mystic",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Mystic Seer.png"},
  {id:"fnd-seeker-career",name:"Seeker Career",career:"Seeker",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/4 - Seeker Career.png"},
  {id:"fnd-ataru-striker",name:"Ataru Striker",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Ataru Striker.png"},
  {id:"fnd-executioner",name:"Executioner",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Executioner.png"},
  {id:"fnd-hermit",name:"Hermit",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Hermit.png"},
  {id:"fnd-hunter",name:"Hunter",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Hunter.png"},
  {id:"fnd-navigator",name:"Navigator",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Navigator.png"},
  {id:"fnd-pathfinder",name:"Pathfinder",career:"Seeker",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Seeker Pathfinder.png"},
  {id:"fnd-sentinel-career",name:"Sentinel Career",career:"Sentinel",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/5 - Sentinel Career.png"},
  {id:"fnd-artisan",name:"Artisan",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Artisan.png"},
  {id:"fnd-investigator",name:"Investigator",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Investigator.png"},
  {id:"fnd-racer",name:"Racer",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Racer.png"},
  {id:"fnd-sentry",name:"Sentry",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Sentry.png"},
  {id:"fnd-shadow",name:"Shadow",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Shadow.png"},
  {id:"fnd-shien-expert",name:"Shien Expert",career:"Sentinel",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Sentinel Shien Expert.png"},
  {id:"fnd-warrior-career",name:"Warrior Career",career:"Warrior",game:"Force and Destiny",kind:"career",nodes:18,image:"/Spec FaD/6 - Warrior Career.png"},
  {id:"fnd-aggressor",name:"Aggressor",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Aggressor.png"},
  {id:"fnd-colossus",name:"Colossus",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Colossus.png"},
  {id:"fnd-juyo-berserker",name:"Juyo Berserker",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Juyo Berserker.png"},
  {id:"fnd-shii-cho-knight",name:"Shii-Cho Knight",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Shii-Cho Knight.png"},
  {id:"fnd-starfighter-ace",name:"Starfighter Ace",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Starfighter Ace.png"},
  {id:"fnd-steel-hand-adept",name:"Steel Hand Adept",career:"Warrior",game:"Force and Destiny",kind:"specialization",nodes:20,image:"/Spec FaD/Warrior Steel Hand Adept.png"},
  // Age of Rebellion
  {id:"aor-ace-career",name:"Ace Career",career:"Ace",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/1- Ace Career.jpg"},
  {id:"aor-beast-rider",name:"Beast Rider",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Beast Rider.jpg"},
  {id:"aor-driver",name:"Driver",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Driver.jpg"},
  {id:"aor-gunner",name:"Gunner",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Gunner.jpg"},
  {id:"aor-hotshot",name:"Hotshot",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Hotshot.jpg"},
  {id:"aor-pilot",name:"Pilot",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Pilot.jpg"},
  {id:"aor-rigger",name:"Rigger",career:"Ace",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Ace Rigger.jpg"},
  {id:"aor-commander-career",name:"Commander Career",career:"Commander",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/2 - Commander Career.jpg"},
  {id:"aor-commodore",name:"Commodore",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Commodore.jpg"},
  {id:"aor-figurehead",name:"Figurehead",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Figurehead.jpg"},
  {id:"aor-instructor",name:"Instructor",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Instructor.jpg"},
  {id:"aor-squadron-leader",name:"Squadron Leader",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Squadron Leader.jpg"},
  {id:"aor-strategist",name:"Strategist",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Strategist.jpg"},
  {id:"aor-tactician",name:"Tactician",career:"Commander",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Commander Tactician.jpg"},
  {id:"aor-diplomat-career",name:"Diplomat Career",career:"Diplomat",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/3 - Diplomat Career.jpg"},
  {id:"aor-advocate",name:"Advocate",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Advocate.jpg"},
  {id:"aor-agitator",name:"Agitator",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Agitator.jpg"},
  {id:"aor-ambassador",name:"Ambassador",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Ambassador.jpg"},
  {id:"aor-analyst",name:"Analyst",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Analyst.jpg"},
  {id:"aor-propagandist",name:"Propagandist",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Propagandist.jpg"},
  {id:"aor-quartermaster",name:"Quartermaster",career:"Diplomat",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Diplomat Quartermaster.jpg"},
  {id:"aor-engineer-career",name:"Engineer Career",career:"Engineer",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/4 - Engineer Career.jpg"},
  {id:"aor-droid-specialist",name:"Droid Specialist",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Droid Specialist.jpg"},
  {id:"aor-mechanic",name:"Mechanic",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Mechanic.jpg"},
  {id:"aor-saboteur",name:"Saboteur",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Saboteur.jpg"},
  {id:"aor-sapper",name:"Sapper",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Sapper.jpg"},
  {id:"aor-scientist",name:"Scientist",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Scientist.jpg"},
  {id:"aor-shipwright",name:"Shipwright",career:"Engineer",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Engineer Shipwright.jpg"},
  {id:"aor-soldier-career",name:"Soldier Career",career:"Soldier",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/5 - Soldier Career.jpg"},
  {id:"aor-commando",name:"Commando",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Commando.jpg"},
  {id:"aor-heavy",name:"Heavy",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Heavy.jpg"},
  {id:"aor-medic",name:"Medic",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Medic.jpg"},
  {id:"aor-sharpshooter",name:"Sharpshooter",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Sharpshooter.jpg"},
  {id:"aor-trailblazer",name:"Trailblazer",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Trailblazer.jpg"},
  {id:"aor-vanguard",name:"Vanguard",career:"Soldier",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Soldier Vanguard.jpg"},
  {id:"aor-spy-career",name:"Spy Career",career:"Spy",game:"Age of Rebellion",kind:"career",nodes:18,image:"/Spec AoR/6 - Spy Career.jpg"},
  {id:"aor-courier",name:"Courier",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Courier.jpg"},
  {id:"aor-infiltrator",name:"Infiltrator",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Infiltrator.jpg"},
  {id:"aor-interrogator",name:"Interrogator",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Interrogator.jpg"},
  {id:"aor-scout",name:"Scout",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Scout.jpg"},
  {id:"aor-sleeper-agent",name:"Sleeper Agent",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Sleeper Agent.jpg"},
  {id:"aor-slicer",name:"Slicer",career:"Spy",game:"Age of Rebellion",kind:"specialization",nodes:20,image:"/Spec AoR/Spy Slicer.jpg"},
  // Universal
  {id:"uni-cartel-dealer",name:"Cartel Dealer",career:"Universal",game:"Universal",kind:"specialization",nodes:20,image:"/Spec ToR/Universal - Cartel Dealer.png"},
  {id:"uni-gladiator",name:"Gladiator",career:"Universal",game:"Universal",kind:"specialization",nodes:20,image:"/Spec ToR/Universal - Gladiator .png"},
  {id:"uni-imperial-loyalist",name:"Imperial Loyalist",career:"Universal",game:"Universal",kind:"specialization",nodes:20,image:"/Spec ToR/Universal - Imperial Loyalist.png"},
  {id:"uni-mandalorian-crusader",name:"Mandalorian Crusader",career:"Universal",game:"Universal",kind:"specialization",nodes:20,image:"/Spec ToR/Universal - Mandalorian Crusader.png"},
  // The Old Republic
  {id:"tor-sith-acolyte",name:"Acolyte",career:"Sith",game:"The Old Republic",kind:"specialization",nodes:20,image:"/Spec ToR/Sith - Acolyte.png"},
  {id:"tor-sith-blademaster",name:"Blademaster",career:"Sith",game:"The Old Republic",kind:"specialization",nodes:20,image:"/Spec ToR/Sith - Blademaster.png"},
  {id:"tor-sith-lord",name:"Lord",career:"Sith",game:"The Old Republic",kind:"specialization",nodes:20,image:"/Spec ToR/Sith -Lord.png"},
  {id:"tor-sith-sorcerer",name:"Sorcerer",career:"Sith",game:"The Old Republic",kind:"specialization",nodes:20,image:"/Spec ToR/Sith - Sorcerer.png"},
];

// Ids from the earlier reference-image trees map to the ids above (same node numbering), so old saves keep their progress.
export const legacyTreeIds:Readonly<Record<string,string>>={
  "bounty-hunter-career": "eoe-bounty-hunter-career",
  "colonist-career": "eoe-colonist-career",
  "explorer-career": "eoe-explorer-career",
  "hired-gun-career": "eoe-hired-gun-career",
  "smuggler-career": "eoe-smuggler-career",
  "technician-career": "eoe-technician-career",
  "bounty-hunter-assassin": "eoe-assassin",
  "bounty-hunter-gadgeteer": "eoe-gadgeteer",
  "bounty-hunter-martial-artist": "eoe-martial-artist",
  "bounty-hunter-operator": "eoe-operator",
  "bounty-hunter-skip-tracer": "eoe-skip-tracer",
  "bounty-hunter-survivalist": "eoe-survivalist",
  "colonist-doctor": "eoe-doctor",
  "colonist-entrepreneur": "eoe-entrepreneur",
  "colonist-marshal": "eoe-marshal",
  "colonist-performer": "eoe-performer",
  "colonist-politico": "eoe-politico",
  "colonist-scholar": "eoe-scholar",
  "explorer-archaeologist": "eoe-archaeologist",
  "explorer-big-game-hunter": "eoe-big-game-hunter",
  "explorer-driver": "eoe-driver",
  "explorer-fringer": "eoe-fringer",
  "explorer-scout": "eoe-scout",
  "explorer-trader": "eoe-trader",
  "hired-gun-bodyguard": "eoe-bodyguard",
  "hired-gun-demolitionist": "eoe-demolitionist",
  "hired-gun-enforcer": "eoe-enforcer",
  "hired-gun-heavy": "eoe-heavy",
  "hired-gun-marauder": "eoe-marauder",
  "hired-gun-mercenary-soldier": "eoe-mercenary-soldier",
  "smuggler-charmer": "eoe-charmer",
  "smuggler-gambler": "eoe-gambler",
  "smuggler-gunslinger": "eoe-gunslinger",
  "smuggler-pilot": "eoe-pilot",
  "smuggler-scoundrel": "eoe-scoundrel",
  "smuggler-thief": "eoe-thief",
  "technician-cyber-tech": "eoe-cyber-tech",
  "technician-droid-tech": "eoe-droid-tech",
  "technician-mechanic": "eoe-mechanic",
  "technician-modder": "eoe-modder",
  "technician-outlaw-tech": "eoe-outlaw-tech",
  "technician-slicer": "eoe-slicer",
};

// Tree ids that no longer have a reference image. Progress saved under them is dropped instead of failing validation.
export const retiredTreeIds: ReadonlySet<string> = new Set([
  "uni-force-adherent",
  "uni-force-sensitive-emergent",
  "uni-force-sensitive-exile",
  "uni-imperial-academy-cadet",
  "uni-padawan-survivor",
  "uni-pirate",
  "uni-recruit",
  "uni-retired-clone-trooper",
  "uni-ship-captain",
]);

/** Remap legacy tree ids to their current ids (merging with progress already saved there) and drop retired trees. */
export function migrateTreeProgress(input:unknown):unknown{
 if(!Array.isArray(input))return input;
 const out:Record<string,unknown>[]=[],seen=new Map<string,{index:number;migrated:boolean}>();
 for(const item of input){
  if(!item||typeof item!=='object'||typeof (item as {treeId?:unknown}).treeId!=='string'){out.push(item as Record<string,unknown>);continue;}
  const rec=item as Record<string,unknown>,id=rec.treeId as string;
  if(retiredTreeIds.has(id))continue;
  const legacy=Object.hasOwn(legacyTreeIds,id)?legacyTreeIds[id]:undefined,treeId=legacy??id,prior=seen.get(treeId);
  const a=prior&&out[prior.index].completed,b=rec.completed;
  if(prior&&(prior.migrated||legacy!==undefined)&&Array.isArray(a)&&Array.isArray(b)){
   out[prior.index]={...out[prior.index],completed:[...new Set([...a,...b])].sort((x,y)=>(x as number)-(y as number))};
   prior.migrated=true;continue;
  }
  if(!prior)seen.set(treeId,{index:out.length,migrated:legacy!==undefined});
  out.push(legacy===undefined?rec:{...rec,treeId});
 }
 return out;
}

export const treeProgressSchema=z.preprocess(migrateTreeProgress,z.array(z.object({treeId:z.string(),completed:z.array(z.number().int().min(0)).max(20)}).superRefine((p,ctx)=>{
 const tree=trees.find(t=>t.id===p.treeId);
 if(!tree||p.completed.some(n=>n>=tree.nodes)||new Set(p.completed).size!==p.completed.length)ctx.addIssue({code:'custom',message:'Invalid tree or talent'});
})).max(trees.length).refine(a=>new Set(a.map(t=>t.treeId)).size===a.length,'Duplicate trees'));
export type TreeProgress=z.infer<typeof treeProgressSchema>;

// Normalized checkbox positions (percent of the image) keep marks aligned while the reference image scales.
// The Edge of the Empire, Force and Destiny and Age of Rebellion sheets share one template (1675 x 2175 px).
// The Universal and Old Republic sheets use a different one (1700 x 2200 px).
export function talentPosition(tree:Pick<TreeMeta,'kind'|'game'>,index:number){
 if(tree.game==='Universal'||tree.game==='The Old Republic')
  return {x:[218,563,911,1257][index%4]/1700*100,y:[344,706,1068,1430,1792][Math.floor(index/4)]/2200*100};
 const xs=[118,515,910,1305];
 if(tree.kind==='specialization')return {x:xs[index%4]/1675*100,y:[303,649,996,1343,1690][Math.floor(index/4)]/2175*100};
 const n=index%9,base=index<9?0:952;
 return {x:xs[n===0?0:(n-1)%4]/1675*100,y:(base+(n===0?454:n<=4?729:1003))/2175*100};
}

const treeNorm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
/** The tree image for a specialization name. Names shared by several games resolve to the character's own career, or to none. */
export function findSpecializationTree(name:string,career?:string):TreeMeta|undefined{
 const same=trees.filter(t=>t.kind==='specialization'&&treeNorm(t.name)===treeNorm(name));
 if(same.length<=1)return same[0];
 return same.find(t=>career&&treeNorm(t.career)===treeNorm(career));
}
export function findCareerTree(career?:string):TreeMeta|undefined{
 return career?trees.find(t=>t.kind==='career'&&treeNorm(t.career)===treeNorm(career)):undefined;
}
/** The trees a character sheet implies: its career tree and one per specialization, with the talents already bought ticked. */
export function treesForCharacter(c:{career?:string;specializations:string[];treeProgress?:{spec:string;nodes:number[]}[]}){
 const out=new Map<string,{treeId:string;completed:number[]}>();
 const career=findCareerTree(c.career);
 if(career)out.set(career.id,{treeId:career.id,completed:[]});
 for(const name of c.specializations){
  const t=findSpecializationTree(name,c.career);
  if(!t)continue;
  const nodes=(c.treeProgress??[]).filter(p=>treeNorm(p.spec)===treeNorm(name)).flatMap(p=>p.nodes).filter(n=>n>=0&&n<t.nodes);
  out.set(t.id,{treeId:t.id,completed:[...new Set([...(out.get(t.id)?.completed??[]),...nodes])].sort((a,b)=>a-b)});
 }
 return [...out.values()];
}
