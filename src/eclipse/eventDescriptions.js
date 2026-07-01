/**
 * Historical and scientific descriptions for notable astronomical events.
 *
 * Keys:
 *   ECLIPSE_DESCRIPTIONS  — ISO date string, negative year for BCE (e.g. '-0584-05-28')
 *   TRANSIT_DESCRIPTIONS  — `${planet.toLowerCase()}-${year}` (e.g. 'venus-1769')
 *   METEOR_DESCRIPTIONS   — shower name string (e.g. 'Leonids')
 */

// ---------------------------------------------------------------------------
// Solar & Lunar Eclipses
// ---------------------------------------------------------------------------

export const ECLIPSE_DESCRIPTIONS = {

  // --- Solar eclipses ---

  '-0762-06-15': {
    title: 'The Bur-Sagale Eclipse',
    body:
      'Recorded in Assyrian limmu lists as occurring during the eponymy of Bur-Sagale, governor of Guzana, this eclipse is one of the oldest astronomically datable events in human history. Cuneiform tablets describe it as causing the sun to "vanish in the daytime," and modern calculations confirm a total solar eclipse visible from Nineveh on June 15, 763 BC. Because Assyrian records are a continuous year-by-year chain, this single event anchors the chronology of the ancient Near East, allowing historians to cross-reference Egyptian, Babylonian, and Hebrew timelines with modern calendar precision.',
  },

  '-0584-05-28': {
    title: 'The Eclipse of Thales',
    body:
      'Around May 28, 585 BC, a solar eclipse halted a battle between the Lydian army of Alyattes and the Median forces of Cyaxares on the banks of the Halys River in what is now Turkey. The sudden darkness was interpreted as a divine sign, and both sides immediately laid down their arms and negotiated peace. The Greek philosopher Thales of Miletus had reportedly predicted the eclipse years in advance — an extraordinary claim if true, since Greek astronomy of the era lacked the Saros-cycle knowledge needed to do so — making it the first alleged scientific prediction of a total solar eclipse in Western history.',
  },

  '-0412-08-27': {
    title: "Thucydides' Eclipse",
    body:
      'In the summer of 413 BC, a solar eclipse darkened the skies over the Aegean while Athens was engaged in its disastrous Sicilian Expedition. The historian Thucydides, himself a former Athenian general, recorded the eclipse matter-of-factly alongside the military narrative — treating it as a natural event rather than a portent, an unusually scientific stance for the era. The eclipse is one of several astronomical cross-references that allow modern historians to pin exact dates to events in the Peloponnesian War.',
  },

  '-0330-09-20': {
    title: "Alexander's Lunar Eclipse Before Gaugamela",
    body:
      'On September 20, 331 BC — just eleven days before the Battle of Gaugamela — a total lunar eclipse turned the moon blood-red over Alexander the Great\'s camp. Alexander\'s chief seer, Aristander of Telmessus, interpreted it as foretelling Persian defeat: the moon symbolized Persia, and its darkening meant Persia\'s doom. Whether as a genuine omen or shrewd psychological theater, the reading proved correct; at Gaugamela on October 1, Alexander shattered Darius III\'s vastly larger army and effectively ended the Achaemenid Empire.',
  },

  '1715-05-03': {
    title: "Halley's Eclipse",
    body:
      'Edmond Halley — better known for the comet bearing his name — produced the first scientifically calculated eclipse path in history for the total solar eclipse of May 3, 1715, which swept across England from Cornwall to Lincolnshire. He distributed printed maps to observers across the country asking them to note the exact duration of totality, then used their reports to refine lunar theory. His predicted path was accurate to within about 18 miles, an astonishing achievement for the era, and the coordinated citizen-science campaign he organized was arguably the first of its kind.',
  },

  '1868-08-18': {
    title: 'The Discovery of Helium',
    body:
      'During the total solar eclipse of August 18, 1868, French astronomer Jules Janssen pointed a spectroscope at the sun\'s chromosphere from Guntur, India, and detected a bright yellow spectral line that matched no known element on Earth. English astronomer Norman Pogson made a similar observation, and independently Joseph Norman Lockyer identified the line in London months later, naming the mystery element "helium" after Helios, the Greek sun god. It was the first element to be discovered in space before it was found on Earth — terrestrial helium wasn\'t isolated until 1895 by William Ramsay.',
  },

  '1878-07-29': {
    title: "Edison's Eclipse and the Hunt for Vulcan",
    body:
      'The total solar eclipse of July 29, 1878, sent a wave of scientists into the American West, including Thomas Edison, who set up in Rawlins, Wyoming to test a new heat-sensing device called a tasimeter on the solar corona. More urgently, astronomers including James Craig Watson and Lewis Swift believed totality would reveal Vulcan — a hypothetical planet between Mercury and the Sun whose existence had been proposed to explain Mercury\'s orbital drift. Watson claimed to have spotted two anomalous objects, but no one could confirm the sighting, and the hunt for Vulcan was quietly shelved; the orbital anomaly was finally explained by Einstein\'s general relativity in 1915.',
  },

  '1919-05-29': {
    title: "Eddington's Eclipse: Light Bends Around the Sun",
    body:
      'On May 29, 1919, British astronomer Arthur Eddington led expeditions to the island of Príncipe off West Africa and to Sobral, Brazil, to photograph stars near the sun during totality and test Einstein\'s prediction that gravity bends light. Einstein\'s general relativity forecast that starlight passing close to the sun would be deflected by 1.75 arcseconds — exactly double the Newtonian prediction. Eddington\'s measurements matched Einstein\'s figure, and when the results were announced in November 1919 they made headlines worldwide, transforming Einstein into an international celebrity overnight and cementing general relativity as the successor to Newtonian gravity.',
  },

  '2017-08-21': {
    title: 'The Great American Eclipse',
    body:
      'The total solar eclipse of August 21, 2017 swept a 70-mile-wide corridor of totality from Oregon to South Carolina, becoming the first transcontinental total solar eclipse visible in the contiguous United States since 1918. An estimated 215 million adults — about two-thirds of the U.S. adult population — watched it in person or via livestream, making it arguably the most widely observed eclipse in history. Scientists deployed a vast network of instruments along the path, collecting data on the corona, ionospheric disruption, and animal behavior; the event also triggered record sales of eclipse glasses and a dramatic spike in interstate travel.',
  },

  // --- Lunar eclipses ---

  '-0412-08-27-lunar': {
    title: 'The Eclipse That Doomed Athens in Sicily',
    body:
      'On August 27, 413 BC, a total lunar eclipse appeared just as the Athenian general Nicias was preparing to withdraw his fleet from the harbor of Syracuse after a string of defeats. Nicias, deeply superstitious, heeded his soothsayers\' advice that the army must wait "thrice nine days" before departing. That delay proved catastrophic: the Syracusans used the time to blockade the harbor, and the entire Athenian expedition — perhaps 40,000 men — was annihilated. Thucydides recorded the eclipse and Nicias\'s fatal decision in his History of the Peloponnesian War, making it one of the most consequential celestial events ever documented.',
  },

  '-0330-09-20-lunar': {
    title: "The Blood Moon Before Gaugamela",
    body:
      'On the night of September 20, 331 BC, a total lunar eclipse cast an eerie red glow over the Macedonian camp of Alexander the Great as he marched toward the Persian heartland. His court seer Aristander declared it a favorable omen: the moon, a symbol of Persia, was being eclipsed while the sun — associated with Alexander and the Macedonians — remained brilliant. The army\'s morale surged, and eleven days later Alexander won the decisive Battle of Gaugamela, destroying Darius III\'s empire and opening the way to Persepolis, Babylon, and ultimately India.',
  },

  '1504-02-29': {
    title: 'Columbus and the Lunar Eclipse Gambit',
    body:
      'Stranded in Jamaica since June 1503 with a worm-eaten, unseaworthy fleet, Christopher Columbus faced a crisis: the local Arawak people had stopped supplying food to his increasingly unruly crew. Columbus had an almanac prepared by the astronomer Abraham Zacuto that predicted a total lunar eclipse for February 29, 1504. He summoned the village chiefs and warned that his god was about to darken the moon in anger at their refusal to cooperate. As the eclipse unfolded on schedule, the frightened villagers begged him to restore the moon; Columbus disappeared into his cabin for the calculated duration, then emerged to announce his prayers had worked — and food supplies resumed immediately.',
  },

};

// ---------------------------------------------------------------------------
// Planetary Transits
// ---------------------------------------------------------------------------

export const TRANSIT_DESCRIPTIONS = {

  // --- Venus transits ---

  'venus-1639': {
    title: 'The First Observed Transit of Venus',
    body:
      'On December 4, 1639, Jeremiah Horrocks, a 20-year-old English clergyman and self-taught astronomer, became the first person in recorded history to observe a transit of Venus. Kepler had predicted no transit until 1761, but Horrocks recalculated Venus\'s orbit and realized there would be one in 1639 — with only days to spare, he alerted his friend William Crabtree, giving the world its only two observers. Horrocks watched through a simple telescope in Much Hoole, Lancashire, projecting the sun\'s image onto a card; he died at age 22 before his notes were published, but they transformed understanding of Venus\'s size and laid groundwork for later measurements of the solar system\'s scale.',
  },

  'venus-1761': {
    title: 'Science Goes Global: 176 Observers Across the World',
    body:
      'The transit of June 6, 1761 triggered the first true international scientific expedition in history. Responding to a proposal by Edmond Halley (who had died before he could see it), the academies of Europe dispatched 176 observers to 117 stations on six continents, from Siberia to St. Helena to Newfoundland — an unprecedented feat of peacetime cooperation even though Britain and France were at war. The goal was to use parallax: observers at widely separated locations would time the transit slightly differently, and trigonometry would yield the Earth-Sun distance. Results were inconclusive due partly to the "black drop effect," but the enterprise established the template for international big-science collaboration.',
  },

  'venus-1769': {
    title: 'Captain Cook, Tahiti, and the Scale of the Solar System',
    body:
      'The transit of June 3, 1769 sent Captain James Cook and astronomer Charles Green to Tahiti aboard HMS Endeavour — Cook\'s first voyage, which also produced the first European maps of New Zealand and eastern Australia. Observations from Tahiti, combined with data from 151 other stations worldwide including Hudson Bay and Lapland, were used by the astronomer Thomas Hornsby to calculate the astronomical unit at 93,726,900 miles — within about 0.8% of the modern value of 92,955,807 miles. It was the most precise measurement of the solar system\'s scale achieved to that point in history, and it completed the project Halley had proposed decades earlier.',
  },

  'venus-1874': {
    title: 'The Transit That Launched Astronomical Photography',
    body:
      'The transit of December 9, 1874 was the first for which photography was used as a primary scientific tool, rather than visual timing alone. France sent multiple expeditions armed with the newly perfected "photoheliograph" designed by Jules Janssen (who had also discovered helium six years earlier), producing sequences of images meant to capture the exact moments of ingress and egress with mechanical precision. The U.S. Naval Observatory built a set of portable observatories and dispatched eight expeditions to sites including Japan, Chatham Island, and Kerguelen Island. Though the black-drop effect still complicated results, the transit pioneered astrophotography as a scientific discipline.',
  },

  'venus-1882': {
    title: 'The Last Transit for 121 Years',
    body:
      'The transit of December 6, 1882 was the last transit of Venus the 19th century would see — the next pair would not occur until 2004 and 2012. Astronomers knew this, and turned out in extraordinary numbers: the United States alone sent eight expeditions to sites including Egypt, New Zealand, and South Africa. Samuel Langley, later to direct the Smithsonian Institution, observed from Mount Whitney in California. The resulting calculations pinned the astronomical unit at approximately 92,930,000 miles, remarkably close to the true figure, and for decades afterward this transit\'s data remained the gold standard for the Earth-Sun distance.',
  },

  'venus-2004': {
    title: 'The First Transit in 122 Years',
    body:
      'On June 8, 2004, Venus crossed the face of the sun for the first time since 1882 — 122 years during which the entire space age had come and gone without anyone alive being able to see this phenomenon. Millions watched online via NASA livestreams, and amateur and professional astronomers in Europe, Asia, and Africa had clear skies for a spectacular view. Unlike the 18th-century expeditions that needed the transit to measure the solar system, modern observers used it to calibrate techniques for detecting exoplanet transits around other stars — Venus provided a perfect test case for the methods now used by missions like Kepler and TESS.',
  },

  'venus-2012': {
    title: 'The Last Transit Until 2117',
    body:
      'The transit of June 5–6, 2012 was the second of the 2004–2012 pair and the last transit of Venus any person alive today will ever see — the next will not occur until December 10–11, 2117. NASA\'s Solar Dynamics Observatory captured the event in stunning high-definition across multiple wavelengths, revealing the Venusian atmosphere as a luminous arc of refracted sunlight at ingress and egress — a technique astronomers are now applying to characterize the atmospheres of exoplanets. An estimated 6 million people gathered at organized viewing events worldwide, making it one of the most celebrated astronomical occasions of the 21st century so far.',
  },

  // --- Mercury transits ---

  'mercury-1631': {
    title: "Gassendi Sees What Kepler Predicted",
    body:
      'Johannes Kepler predicted that Mercury would transit the sun on November 7, 1631 — a remarkable achievement given the incomplete planetary data he had to work with — but he died in November 1630, never to see his forecast validated. French philosopher-astronomer Pierre Gassendi set up in Paris on the predicted date and, after hours of watching through clouds, glimpsed Mercury crossing the solar disc: the tiny planet was far smaller than anyone expected, confirming that it could not be used to reliably estimate planetary sizes as astronomers had hoped. The observation also showed that Kepler\'s laws of planetary motion were quantitatively accurate enough to predict rare celestial events years in advance.',
  },

  'mercury-1677': {
    title: "Halley's Parallax Epiphany at St. Helena",
    body:
      'At age 21, Edmond Halley traveled to the remote island of St. Helena to catalog southern hemisphere stars, and there observed a transit of Mercury on November 7, 1677. Timing the transit with exceptional precision, he realized that if observers at widely separated latitudes timed the same transit, the slight difference in the duration of Venus\'s (or Mercury\'s) crossing could — through trigonometry — yield an accurate measurement of the Earth-Sun distance, the cornerstone of all astronomical distances. Halley spent decades promoting this "parallax method" and wrote a celebrated 1716 paper urging future astronomers to capitalize on the Venus transits of 1761 and 1769; he knew he would not live to see them, but they ultimately vindicated his method.',
  },

  'mercury-2016': {
    title: 'A 7.5-Hour Crossing',
    body:
      'On May 9, 2016, Mercury traced a slow arc across the sun over 7 hours and 29 minutes — one of the longer Mercury transits possible, since it occurred near Mercury\'s descending node when the planet\'s path across the solar disc is longest. Hundreds of thousands of observers used filtered telescopes and solar viewers across the Americas, Europe, and Africa to follow the event, while NASA\'s Solar Dynamics Observatory streamed crisp imagery from orbit. The transit served as a calibration opportunity for solar instruments and a vivid reminder of Mercury\'s true scale: the planet appeared as a jet-black dot barely 1/160th the diameter of the sun, smaller than most sunspots.',
  },

};

// ---------------------------------------------------------------------------
// Meteor Showers
// ---------------------------------------------------------------------------

export const METEOR_DESCRIPTIONS = {

  'Leonids': {
    title: 'The Most Unpredictable Shower — and the Greatest Storms',
    body:
      'The Leonids are the most violently variable meteor shower known: in most years they produce a modest 10–15 meteors per hour, but roughly every 33 years — when Earth passes through a dense debris ribbon shed by Comet 55P/Tempel-Tuttle — they can explode into storms of thousands or even hundreds of thousands of meteors per hour. The 1833 storm is the benchmark: observers across North America saw an estimated 100,000 meteors per hour, with witnesses describing the sky as "raining fire" and many believing the apocalypse had come. Another stunning storm in November 1966 produced rates of 40–150 meteors per second at peak, with observers in the American Southwest reporting a continuous luminous display that made it impossible to count individual meteors.',
  },

  'Leonids-1833': {
    title: "The Night the Stars Fell: America's Great Meteor Storm",
    body:
      'In the pre-dawn hours of November 13, 1833, the sky over North America erupted with the most spectacular meteor storm in recorded history. Observers from Canada to Mexico watched in terror as an estimated 100,000 meteors per hour streaked from a single point in Leo — church bells rang, people fled into the streets, and preachers declared the Day of Judgment at hand. The storm was the event that turned meteors from folklore into science: Yale mathematician Denison Olmsted collected eyewitness accounts and correctly deduced that the meteors emanated from a fixed point in space (the radiant) and that Earth was plowing through a swarm of particles orbiting the sun, founding the modern understanding of meteor showers.',
  },

  'Leonids-1966': {
    title: 'Forty Meteors Per Second',
    body:
      'On the night of November 16–17, 1966, observers in the American Southwest witnessed a Leonid storm that briefly reached an almost incomprehensible rate of 40–150 meteors per second — roughly 144,000 per hour at the peak, which lasted only about 40 minutes centered around 4 AM MST. Astronomers at Kitt Peak and other observatories scrambled their equipment and described the display as a "snowstorm" of light, with meteors arriving faster than they could be individually tracked. The storm confirmed predictions by astronomer Donald Olivier that Leonid activity should peak near Tempel-Tuttle\'s 33-year orbital period, and the event remains the highest-rate meteor storm measured by modern instruments.',
  },

  'Perseids': {
    title: "The Tears of St. Lawrence — Reliable and Ancient",
    body:
      'The Perseid meteor shower, peaking each year around August 11–13, is the most reliably spectacular annual shower visible from the Northern Hemisphere, with rates of 50–100 meteors per hour under dark skies. Its European name, "the Tears of St. Lawrence," comes from its coincidence with the feast day of the martyred Saint Lawrence on August 10, and references to the shower appear in Chinese astronomical records as far back as 36 AD, making it one of the longest-documented meteor displays in history. The Perseids are produced by debris shed by Comet 109P/Swift-Tuttle, whose 130-year orbit occasionally deposits fresh material that enhances the shower; in 1992, when Swift-Tuttle made its most recent close pass to the Sun, rates briefly spiked to several hundred per hour.',
  },

  'Perseids-1992': {
    title: "Swift-Tuttle's Fresh Debris",
    body:
      'In August 1992, Comet 109P/Swift-Tuttle — the source of the Perseid meteor shower — made its first observed return to the inner solar system since 1862, passing within 110 million miles of Earth in December of that year. As Swift-Tuttle shed fresh icy material heating up near the Sun, Earth plowed through unusually dense debris ribbons in the 1991–1994 Perseid seasons; in August 1992, observers reported enhanced rates of 200–400 meteors per hour compared to the typical 50–100. The event was a reminder that meteor showers are not uniform debris clouds but structured streams of filaments, and it spurred detailed modeling of cometary dust trails that now allows astronomers to forecast Perseid and Leonid outbursts years in advance.',
  },

  'Geminids': {
    title: 'The Shower With a Rocky Source',
    body:
      'The Geminid meteor shower, peaking around December 13–14 each year, is unique among major showers in that its parent body is not a comet but an asteroid: 3200 Phaethon, a curious object that may be a dormant or extinct comet nucleus. With typical rates of 120+ meteors per hour, Geminids are among the richest showers of the year, yet they were first noticed only in 1862 — far later than the Perseids or Leonids — perhaps because they improved gradually as the stream spread. Because Phaethon passes extraordinarily close to the Sun (within 13 million miles, closer than any other named asteroid), it sheds dust through thermal fracturing rather than the ice sublimation that drives comets, making the Geminids a puzzle that planetary scientists are still studying.',
  },

};
