// GEGENEREERD BESTAND — niet met de hand bewerken.
// Bron: data/geo-countries.js + shared/content/countries.data.mjs
// Genereer opnieuw met: node shared/content/build-shapes.mjs
// docs/openstaand/raad-het-land.md, migratiestap 1.
// Stand bij generatie: 225 van 230 pool-landen gekoppeld aan een contour
//   (5 via een handmatige alias, zie MANUAL_ALIASES in build-shapes.mjs).
// Pool-landen ZONDER contour (5): Réunion (re); Mayotte (yt); Martinique (mq); Guadeloupe (gp); French Guiana (gf)
//
// Alleen de iso2-codes — GEEN paddata. Dit is wat de server nodig heeft om te
// weten welk land een contour heeft (server/rules/question-selection.js'
// `hasShape`-parameter voor gameType 'country_shape_mc'); de padstrings
// zelf horen bij shapes.data.mjs, dat alleen de client dynamisch laadt.
export const SHAPE_ISO2S = Object.freeze(["ad","ae","af","ag","ai","al","am","ao","ar","as","at","au","aw","ax","az","ba","bb","bd","be","bf","bg","bh","bi","bj","bn","bo","br","bs","bt","bw","by","bz","ca","cd","cf","cg","ch","ci","cl","cm","cn","co","cr","cu","cv","cw","cy","cz","de","dj","dk","dm","do","dz","ec","ee","eg","eh","er","es","et","fi","fj","fk","fm","fo","fr","ga","gb","gd","ge","gg","gh","gi","gl","gm","gn","gq","gr","gt","gu","gw","gy","hk","hn","hr","ht","hu","id","ie","il","im","in","iq","ir","is","it","je","jm","jo","jp","ke","kg","kh","ki","km","kn","kp","kr","kw","ky","kz","la","lb","lc","li","lk","lr","ls","lt","lu","lv","ly","ma","mc","md","me","mg","mh","mk","ml","mm","mn","mo","mp","mr","ms","mt","mu","mv","mw","mx","my","mz","na","nc","ne","ng","ni","nl","no","np","nr","nz","om","pa","pe","pf","pg","ph","pk","pl","pm","pr","ps","pt","pw","py","qa","ro","rs","ru","rw","sa","sb","sc","sd","se","sg","sh","si","sk","sl","sm","sn","so","sr","ss","st","sv","sx","sy","sz","tc","td","tg","th","tj","tl","tm","tn","to","tr","tt","tv","tw","tz","ua","ug","us","uy","uz","va","vc","ve","vg","vi","vn","vu","ws","xk","ye","za","zm","zw"]);
