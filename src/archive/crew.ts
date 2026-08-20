/**
 * Gänget bakom arkivet, och nickvarianterna de gömde sig bakom.
 *
 * Namnen skrivs med gemener som nicken alltid skrevs — utom secK och CrM,
 * där versalen är en del av namnet.
 *
 * Klantaggar byttes var tredje månad: samma person heter "pXa cater",
 * "[cRAp]cater" och "PRAXXA // cater <LUDDEMENT>". Listan är därför handkurerad
 * — automatisk matchning kan inte skilja "ludde" från klanen "carpeludus".
 *
 * Matchningen sker på HELA TOKENS, inte delsträngar. "wb" och "lim" är annars
 * så korta att de träffar "mbwb" och "Corey Williams". Ett namn delas på
 * icke-alfanumeriska tecken och matchar om någon token är exakt ett alias.
 */

export type CrewMember = {
  id: string;
  name: string;
  /** Tokens som identifierar personen, gemener. */
  aliases: string[];
  /** Hela namn som ska ignoreras trots att en token matchar. */
  notMe?: string[];
};

export const CREW: readonly CrewMember[] = [
  { id: 'ludde', name: 'luddement', aliases: ['cater', 'caterpiller', 'ldmnt', 'luddement', 'luddi', 'ludde', 'ludd', 'luddan', 'luddy'] },
  { id: 'makk', name: 'makk', aliases: ['makk', 'm4kk', 'smakk', 'defmakk', 'marcus'] },
  { id: 'infe', name: 'infe', aliases: ['infe', 'danne', 'dannelit', 'starfighter'], notMe: ['inferno'] },
    // jokki -> jokkinho är samma fotbollssuffix som 'makk ibrahimovic' och
  // 'infe ibrahimovic'; gänget döpte om sig efter spelare.
  { id: 'chryso', name: 'chryso', aliases: ['chryso', 'jocke', 'joxxville', 'joxx', 'jokki', 'jokkinho'] },
  { id: 'heffa', name: 'heffa', aliases: ['heffa', 'heffski'] },
  { id: 'wb', name: 'wb', aliases: ['wb', 'winberg', 'fred'] },
  { id: 'grapen', name: 'grapen', aliases: ['grapen', 'grape', 'grapedaballa'] },
  { id: 'limlim', name: 'limlim', aliases: ['limlim', 'lim', 'liam'] },
  { id: 'seck', name: 'secK', aliases: ['seck'] },
  { id: 'crm', name: 'CrM', aliases: ['crm'] },
  { id: 'blodan', name: 'blodan', aliases: ['blodan'] },
  { id: 'gorg', name: 'gorg', aliases: ['gorg', 'goggan', 'thomas'], notMe: ['gorgeous', 'gorgonzola'] },
  // "Sajbermovs" är svensk fonetisk stavning av cybermoose; "cy3erm00se"
  // är samma sak med leet. Båda är samma person.
  { id: 'm00se', name: 'cyberm00se', aliases: ['m00se', 'moose', 'cy3erm00se', 'c00lm00se', 'sajbermovs', 'cybermoose', 'wictor'] },
    // 'tobbi' är hans enda spår i arkivet: två BajZLan-demos 2004, i samma
  // sällskap som '[BajZLan] luddi'.
  { id: 'tobban', name: 'tobban', aliases: ['tobban', 'tobbzt', 'tobbi', 'toobee'] },
];

/**
 * Delar ett spelarnamn i jämförbara tokens.
 *
 *   "PRAXXA // cater <LUDDEMENT>"  ->  praxxa, cater, luddement
 *   "sticky inf:E"                 ->  sticky, infe
 *
 * Klyvningen sker bara på blanksteg och klammer — alltså där en klantagg
 * skiljs från nicket. Skiljetecken INUTI ett ord tas bort utan att dela det,
 * annars blir "inf:E" till "inf" + "e" och matchar inte aliaset "infe".
 * Det gäller 110 av Infes demos.
 */
export const nameTokens = (name: string): string[] => {
  const low = name.normalize('NFKC').toLowerCase();
  // Två tolkningar, båda giltiga, för skiljetecken betyder olika saker:
  //   "inf:E"      -> kolonet är dekoration inuti nicket  -> "infe"
  //   "chryso:-O"  -> kolonet inleder en emoticon         -> "chryso"
  // Att välja en av dem tappar den andra, så unionen används.
  const split = low.split(/[^a-z0-9]+/);
  const glued = low.split(/[\s[\]()<>{}|]+/).map((part) => part.replace(/[^a-z0-9]+/g, ''));
  return [...new Set([...split, ...glued])].filter(Boolean);
};

export const crewMemberForName = (name: string): CrewMember | undefined => {
  const low = name.toLowerCase();
  const tokens = new Set(nameTokens(name));
  return CREW.find((member) => {
    if (member.notMe?.some((bad) => low.includes(bad))) return false;
    return member.aliases.some((alias) => tokens.has(alias));
  });
};

/**
 * Klanerna gänget spelade i. 322 olika stavningar av klantaggen döljer sexton
 * faktiska klaner — "praxxa", "pXa" och "PRAXXA" är samma sak, och taggen
 * skrevs om lika ofta som nicken.
 */
export const CLAN_FAMILIES: readonly { name: string; match: RegExp }[] = [
  { name: 'PraXXa', match: /^(praxxa|pxa|pr4xx4)/ },
  { name: 'Stickyfingerz', match: /^sticky/ },
  { name: 'cRAp', match: /^crap/ },
  { name: 'dik / Delta Iota Kappa', match: /^(dik|gotdik|delta)/ },
  { name: 'OTRO1337', match: /^otro/ },
  { name: 'TopGun', match: /^(topgun|team ?topgun)/ },
  // Lagnamnen skrevs "dalinjen", "roedaLinjen", aldrig med ö. Ett regex
  // förankrat i "rö" träffar därför ingenting alls.
  { name: 'Rödalinjen', match: /dalinjen/ },
  { name: 'MangoBeat', match: /^mangobeat/ },
  { name: 'mInc', match: /^minc/ },
  { name: 'evilLOOk', match: /^evillook/ },
  { name: "2l'a'tt f'o'r", match: /^2 ?l/ },
  { name: 'nastygocart', match: /^nastygocart/ },
  { name: 'nereid', match: /^nereid/ },
  { name: 'risc', match: /^risc/ },
  { name: 'Buccaneerz', match: /^buccaneerz/ },
  { name: 'BajZLan', match: /^bajzlan/ },
];
