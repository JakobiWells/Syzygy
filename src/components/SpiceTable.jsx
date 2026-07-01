import { useState, Fragment } from 'react'

const GROUPS = [
  {
    name: 'Foundation',
    spices: [
      {
        name: 'Salt',
        origin: 'Universal',
        description: "The single most important ingredient in cooking. Salt doesn't add flavor so much as reveal it — it suppresses bitterness, amplifies sweetness, and brings everything into focus. Kosher salt is the everyday workhorse. Fleur de sel and sea salt flakes are for finishing. If a dish tastes flat, start here.",
      },
      {
        name: 'Black Pepper',
        origin: 'India',
        description: "The world's most traded spice and the universal partner to salt. Freshly ground is a completely different ingredient than pre-ground — bright, sharp, and slightly fruity versus flat and dusty. Add late in cooking to preserve its volatile oils. Essential in nearly every savory dish on earth.",
      },
      {
        name: 'Garlic Powder',
        origin: 'Central Asia',
        description: "Dehydrated garlic with a mellow, rounded flavor that integrates into spice blends and dry rubs more evenly than fresh. Unlike fresh garlic, it won't burn, won't turn bitter, and delivers consistent flavor throughout a dish. Essential in BBQ rubs, seasoning blends, and any dry application.",
      },
      {
        name: 'Onion Powder',
        origin: 'Central Asia',
        description: "Ground dehydrated onion with a sweeter, mellower character than fresh. Dissolves invisibly into sauces, rubs, and marinades, adding body and savory depth without texture. Pairs almost universally with garlic powder as a foundational base. A workhorse in any serious spice drawer.",
      },
    ],
  },
  {
    name: 'Heat',
    spices: [
      {
        name: 'Cayenne',
        origin: 'Americas',
        description: "Pure dried and ground cayenne chili, delivering clean, sharp heat without much flavor complexity. The standard for adding heat — used in tiny amounts to lift other spices, or in larger amounts when you actually want something hot. Consistent and reliable, with almost no flavor beyond the burn.",
      },
      {
        name: 'Paprika',
        origin: 'Hungary / Americas',
        description: "Ground from dried red peppers with a flavor ranging from sweet and mild to sharp. Hungarian paprika is considered the gold standard — fruity and rich. Spanish varieties are milder. Adds beautiful red-orange color and a gentle pepper flavor. An underrated spice: use more of it than you think.",
      },
      {
        name: 'Smoked Paprika',
        origin: 'Spain',
        description: "Paprika made from peppers slow-dried over oak fires before grinding. A Spanish specialty (pimentón de la Vera) with deep campfire smokiness layered over pepper sweetness. Transforms ordinary beans, eggs, or roasted vegetables into something that tastes like it came off a grill.",
      },
      {
        name: 'Chili Flakes',
        origin: 'Americas',
        description: "Crushed dried red chilis — seeds, skins, and all — with fruity heat that has a slight delay. As much a finishing spice as a cooking one. Bloomed in hot oil it becomes aromatic and rich; added raw at the table it stays bright and sharp. Standard on pizza in the Western world.",
      },
      {
        name: 'Chili Powder',
        origin: 'Americas',
        description: "A blend of ground chili peppers, cumin, garlic, and oregano — the backbone of Tex-Mex and American chili. Earthier and more complex than cayenne, with a warmth that develops over cooking. Use it by the tablespoon in the right applications, not just by the pinch.",
      },
      {
        name: 'White Pepper',
        origin: 'India',
        description: "Fully ripe peppercorns that have been soaked and had their outer skin removed before drying. Hotter than black pepper but with a mustier, more fermented, almost funky depth. Essential in Chinese cooking and light-colored dishes like cream soups or béchamel where black specks would be unwanted.",
      },
      {
        name: 'Ancho Chili',
        origin: 'Mexico',
        description: "Dried and ground poblano peppers — the mildest of the Mexican dried chilis. Deeply fruity and raisin-like, with a gentle building heat. One of the soul spices of mole negro. Pairs beautifully with chocolate, tomatoes, and rich braises. Essential to authentic Mexican cooking.",
      },
      {
        name: 'Chipotle',
        origin: 'Mexico',
        description: "Jalapeños that have been smoked and dried — sold whole, canned in adobo sauce, or ground. Delivers medium heat with a distinctive campfire smokiness and underlying sweetness. Adds a recognizable BBQ-adjacent depth to soups, braises, salsas, and anything that should taste like a fire was involved.",
      },
      {
        name: 'Gochugaru',
        origin: 'Korea',
        description: "Korean sun-dried red pepper flakes with a fruity, mildly spicy character and a faint smokiness. The defining spice of kimchi and Korean cooking. Less sharp than cayenne, with more complexity and flavor. Made from a specific variety of Korean chili and not easily substituted.",
      },
      {
        name: 'Aleppo Pepper',
        origin: 'Syria / Turkey',
        description: "A Syrian chili flake with moderate heat and a distinctive raisin-like sweetness, mild acidity, and fruity depth. Coarser and slightly oilier than most chili flakes. Named after the Syrian city of Aleppo. Used widely across Middle Eastern and Mediterranean cooking as both a heat source and a flavor.",
      },
      {
        name: 'Kashmiri Chili',
        origin: 'India',
        description: "A dried Indian chili prized primarily for its vivid scarlet color and mild, fruity heat. Responsible for the brilliant red of tandoori, rogan josh, and butter chicken — without overwhelming spice. What smoked paprika is to Spanish cooking, Kashmiri chili is to North Indian cooking.",
      },
      {
        name: 'Urfa Biber',
        origin: 'Turkey',
        description: "A Turkish chili with a dark purple-black color and one of the most complex flavor profiles of any dried pepper — smoky, raisin-like, chocolate-adjacent, with a slow burn. Dried through a unique process of alternating sun and nighttime sweating. Transforms any dish that gets it.",
      },
    ],
  },
  {
    name: 'Earthy',
    spices: [
      {
        name: 'Cumin',
        origin: 'Middle East / India',
        description: "One of the most widely used spices on the planet — the defining flavor of Mexican, Indian, and Middle Eastern cooking. Warm, earthy, slightly bitter, and faintly smoky. Toast whole seeds before grinding for significantly more depth. Pairs naturally with coriander in almost everything.",
      },
      {
        name: 'Coriander',
        origin: 'Mediterranean / India',
        description: "The dried seed of the cilantro plant, tasting nothing like the herb. Warm, citrusy, and nutty, with a mild floral edge. Almost universally complementary to cumin — the two are used together across most of the world's cuisines. Excellent in spice rubs, curries, and pickling.",
      },
      {
        name: 'Turmeric',
        origin: 'India',
        description: "The spice responsible for the golden color in curry. Earthy, slightly bitter, and assertive — use it for color as much as flavor. It has been a cooking staple in South and Southeast Asia for thousands of years, and appears in everything from curry to golden milk to rice dishes.",
      },
      {
        name: 'Fenugreek',
        origin: 'India / Mediterranean',
        description: "Tiny golden seeds with a peculiar maple syrup-like aroma and a bitter, nutty flavor. Used in Indian spice blends, pickles, and flatbreads. The ingredient you can't quite identify but notice when it's missing — it adds a warm, slightly sweet depth to curry powders and complex spice mixes.",
      },
      {
        name: 'Sumac',
        origin: 'Middle East',
        description: "Ground from dried sumac berries, delivering a bright, tangy, almost cranberry-like tartness. Used across Middle Eastern cooking as both a spice and a souring agent — the way lime juice is used in Mexican cooking. Excellent on salads, grilled meats, hummus, and as a finishing spice on anything that needs acid.",
      },
      {
        name: 'Asafoetida',
        origin: 'Iran / Afghanistan',
        description: "A dried resin from a giant fennel plant, ground to a pale yellow powder. Smells alarming on its own — sulfurous and intensely pungent — but a tiny amount cooked in hot oil transforms into a mellow, savory onion-garlic flavor. Used in Indian vegetarian cooking, especially in Jain cuisine where onion and garlic are avoided.",
      },
      {
        name: 'Amchur',
        origin: 'India',
        description: "Sun-dried unripe mango ground to a fine powder, used as a souring agent across Indian cooking. Adds a fruity tartness similar to citrus but without the liquid. Tenderizes meat, brightens cooked dishes, and is a key component of chaat masala. An essential tool for adding acid without changing a dish's texture.",
      },
      {
        name: 'Annatto',
        origin: 'Latin America / Caribbean',
        description: "Seeds from the achiote plant, used primarily to give foods a vivid orange-red color. The flavor is subtle — earthy and slightly peppery. The natural colorant in many cheeses, butter, and smoked fish. Used in Latin American and Caribbean cooking for color and as a marinade base (achiote paste).",
      },
      {
        name: 'Szechuan Pepper',
        origin: 'China',
        description: "Not actually pepper at all — the dried husks of a prickly ash tree berry. The active compound (hydroxy-alpha-sanshool) creates a unique numbing, tingling sensation on the tongue rather than heat. Citrusy and floral, essential in Sichuan cooking, and a component of Chinese five spice.",
      },
    ],
  },
  {
    name: 'Seeds',
    spices: [
      {
        name: 'Fennel Seeds',
        origin: 'Mediterranean',
        description: "Sweet, anise-flavored seeds from the fennel plant. Less intense than star anise, with a fresher, more herbal quality. Essential in Italian sausage. Toasted and chewed after meals across India as a breath freshener and digestive aid. Pairs beautifully with pork, seafood, and tomato-based dishes.",
      },
      {
        name: 'Mustard Seeds',
        origin: 'Mediterranean / India',
        description: "Available in yellow, brown, and black — heat increases from yellow to black. Nutty when toasted or bloomed in hot oil; sharp and pungent when ground raw. The base of all mustard condiments. In Indian cooking, black mustard seeds are tempered in oil as the aromatic foundation of countless dishes.",
      },
      {
        name: 'Celery Seeds',
        origin: 'India / Europe',
        description: "Tiny, intensely flavored seeds from wild celery — bitter, grassy, and unmistakably celery-like but concentrated. A small amount adds full celery flavor without the texture. Essential in coleslaw dressings, pickling brines, potato salad, and Old Bay seasoning. More useful than you'd expect.",
      },
      {
        name: 'Dill Seeds',
        origin: 'Eastern Europe',
        description: "The seeds of the dill plant, with a flavor similar to the herb but more concentrated and earthier — faintly anise-like with more body. Essential in pickle brine. Also used in rye bread, Scandinavian cooking, and fish dishes. Longer shelf life than the herb, with more punch.",
      },
      {
        name: 'Nigella Seeds',
        origin: 'Middle East / South Asia',
        description: "Small black seeds with a flavor somewhere between oregano, onion, and black pepper — slightly bitter, aromatic, and distinctly savory. Often incorrectly sold as 'black sesame.' Scattered on flatbreads and bagels across the Middle East and South Asia. A key component of the Bengali panch phoron blend.",
      },
      {
        name: 'Caraway Seeds',
        origin: 'Europe / Asia',
        description: "Small crescent-shaped seeds with a distinctive warm, anise-like flavor — the defining flavor of rye bread, German cuisine, and sauerkraut. Commonly confused with cumin by appearance but completely different in taste. An essential European spice that is underused outside of its traditional region.",
      },
      {
        name: 'Poppy Seeds',
        origin: 'Mediterranean / Asia',
        description: "Tiny seeds from the opium poppy with a mild, nutty flavor and pleasant crunch. Used whole on bread, bagels, and pastries across Europe and the Middle East. Ground poppy seed paste is central to Eastern European desserts. Blue-grey seeds are most common; Indian white poppy seeds are used in curries as a thickener.",
      },
      {
        name: 'Sesame Seeds',
        origin: 'Africa / South Asia',
        description: "Rich, nutty seeds used across cuisines from Asia to the Middle East. White seeds are milder and buttery; black seeds are more intense and slightly bitter. The source of tahini and sesame oil. Toasted sesame seeds are a finishing garnish on everything from Japanese rice dishes to Middle Eastern salads.",
      },
    ],
  },
  {
    name: 'Warm & Sweet',
    spices: [
      {
        name: 'Cinnamon',
        origin: 'Sri Lanka',
        description: "Dried inner bark from Cinnamomum trees, in two main varieties: Ceylon (true cinnamon, delicate and floral) and Cassia (the common supermarket type, stronger and slightly harsher). Both are sweet and warming, essential in baking — but Ceylon is preferred when subtlety matters, like in drinking and delicate desserts.",
      },
      {
        name: 'Cardamom',
        origin: 'India',
        description: "Aromatic pods from a plant in the ginger family, with a complex flavor that's floral, sweet, slightly minty, and eucalyptus-like. Green cardamom is the common variety; black cardamom is smoky and more intense. Expensive and powerful — a little goes a long way. Essential in chai, Arabic coffee, and Indian desserts.",
      },
      {
        name: 'Clove',
        origin: 'Indonesia',
        description: "The dried flower buds of a tropical tree, with an intensely sweet, warm, and slightly numbing flavor. One of the most powerful spices — use sparingly. The source of eugenol, a compound with mild anesthetic properties. Essential in mulled wine, holiday baking, ham glazes, and spice blends like garam masala and ras el hanout.",
      },
      {
        name: 'Nutmeg',
        origin: 'Indonesia',
        description: "The seed of the nutmeg tree — warm, sweet, slightly nutty, and aromatic. Used in béchamel sauce, eggnog, rice pudding, and countless baked goods. Mace comes from this same seed's outer coating. Buy whole and grate fresh — pre-ground loses potency rapidly and is a pale comparison.",
      },
      {
        name: 'Allspice',
        origin: 'Caribbean',
        description: "A single spice (not a blend) from a dried berry native to Jamaica that somehow tastes like cinnamon, clove, and pepper simultaneously. Essential in jerk seasoning, Caribbean cooking, and Middle Eastern blends like baharat. Also used in Scandinavian pickling and Eastern European baked goods.",
      },
      {
        name: 'Star Anise',
        origin: 'China / Vietnam',
        description: "Eight-pointed star-shaped pods with an intense licorice-like flavor from the compound anethole. The defining aromatic in pho broth and Chinese red braises. One of the five spices in Chinese five spice. Use whole — they're too fibrous to eat — and remove before serving.",
      },
      {
        name: 'Vanilla',
        origin: 'Mexico',
        description: "The cured seed pod of a tropical orchid vine, native to Mexico and the world's second most expensive spice after saffron — due to labor-intensive hand-pollination. Extract is convenient; paste is better for visible specks; whole beans are best for custards and infusions. The defining flavor of Western baking and desserts.",
      },
      {
        name: 'Mace',
        origin: 'Indonesia',
        description: "The lacy outer coating (aril) of the nutmeg seed, dried and ground. Similar in flavor to nutmeg but more delicate, slightly more floral, and warmer. Preferred in light-colored cream sauces where nutmeg's speckle would be unwanted. A key flavor in Dutch cooking, English baking, and many classical spice blends.",
      },
      {
        name: 'Saffron',
        origin: 'Iran / Spain',
        description: "The dried stigmas of Crocus sativus — approximately 75,000 flowers to produce one pound. The world's most expensive spice by weight. Adds a vivid golden color and a complex, floral-honeyed, slightly metallic flavor that cannot be replicated. Essential in paella, risotto Milanese, bouillabaisse, and Persian rice dishes.",
      },
      {
        name: 'Juniper Berries',
        origin: 'Europe',
        description: "The female seed cones of juniper shrubs — small, hard, blue-black berries with a piney, citrusy, resinous flavor. The defining botanical in gin. In cooking, used with game meats, venison, pork, and red cabbage. Crack or crush before using to release their essential oils.",
      },
      {
        name: 'Vanilla Powder',
        origin: 'Mexico',
        description: "Ground dried vanilla beans — more concentrated than extract and without the alcohol. Can be used in dry applications, high-heat cooking, and spice rubs where extract would evaporate. Excellent in coffee, dry spice blends, and baking where you want vanilla flavor without added liquid.",
      },
      {
        name: 'Grains of Paradise',
        origin: 'West Africa',
        description: "Related to ginger and cardamom, with a complex flavor: warm and peppery upfront, with floral, herbal, and citrus notes that follow. Used in medieval European cooking and now experiencing a revival among chefs. Excellent on meats, in spice blends, and as a more interesting substitute for black pepper.",
      },
    ],
  },
  {
    name: 'Herbs',
    spices: [
      {
        name: 'Oregano',
        origin: 'Mediterranean',
        description: "Dried oregano is a different and more useful ingredient than fresh in many applications — more concentrated, assertive, and almost peppery. Essential on pizza, in tomato sauce, and across Greek and Italian cooking. Mexican oregano (a different plant entirely) is sharper and more citrusy, used in Tex-Mex and Mexican dishes.",
      },
      {
        name: 'Thyme',
        origin: 'Mediterranean',
        description: "Earthy, slightly floral dried herb with a subtle, highly versatile flavor that works in almost any savory context. Essential in French cooking (herbes de Provence, bouquet garni), roasting, stock-making, and braising. Pairs especially well with chicken, mushrooms, root vegetables, and eggs.",
      },
      {
        name: 'Rosemary',
        origin: 'Mediterranean',
        description: "Intensely aromatic dried herb with a piney, resinous, almost camphor-like flavor. Strong — use less than you think. Essential with lamb, roasted potatoes, and focaccia. Infused in olive oil or cream it becomes more subtle and sophisticated. One of the most recognizable aromas in Mediterranean cooking.",
      },
      {
        name: 'Basil',
        origin: 'India / Mediterranean',
        description: "Dried basil is a pale comparison to fresh but still useful in cooked applications where its sweet, clove-like flavor can develop. Add early in cooking for depth. Best used in slow-cooked sauces, marinades, and spice blends. For anything where basil is the star, use fresh.",
      },
      {
        name: 'Sage',
        origin: 'Mediterranean',
        description: "Dried sage has an earthy, musty, slightly bitter flavor with eucalyptus undertones. Pairs exceptionally well with brown butter, pork, and rich starchy dishes like stuffing and pasta. Powerful — use with restraint. A key herb in Italian cooking and American holiday food.",
      },
      {
        name: 'Bay Leaf',
        origin: 'Mediterranean',
        description: "Dried laurel leaves, used whole to infuse soups, stews, braises, rice, and pickling brines with a subtle, floral, slightly menthol flavor. The effect is cumulative and hard to identify individually — but remove a dish's bay leaf and the difference is noticeable. Always remove before serving.",
      },
      {
        name: 'Marjoram',
        origin: 'Mediterranean',
        description: "A gentler, sweeter relative of oregano with a more delicate, slightly floral character. Often interchangeable with oregano but milder. A key ingredient in herbes de Provence and European sausages. Pairs well with eggs, vegetables, and lighter meat dishes where oregano might overwhelm.",
      },
      {
        name: 'Tarragon',
        origin: 'Central Asia',
        description: "Dried tarragon has a distinctive sweet anise-like flavor that's a cornerstone of French cuisine. Essential in béarnaise sauce, fines herbes, and French sauces for chicken and fish. Use carefully — it can easily dominate. One of the few herbs where the dried form is actually used in classical cooking.",
      },
      {
        name: 'Parsley',
        origin: 'Mediterranean',
        description: "Dried parsley has a mild, grassy flavor that adds a clean, herby note in applications where fresh isn't practical. More useful as a background flavor-builder than as a garnish in its dried form. Found in most commercial spice blends, seasoning mixes, and is a component of the French fines herbes blend.",
      },
      {
        name: 'Dill',
        origin: 'Eastern Europe',
        description: "Dried dill weed has a fresh, grassy, slightly anise flavor essential in Eastern European, Scandinavian, and Middle Eastern cooking. Pairs naturally with fish, yogurt, cucumbers, and potatoes. Add late in cooking to preserve what delicate flavor remains after drying.",
      },
      {
        name: 'Mint',
        origin: 'Mediterranean',
        description: "Dried mint is concentrated and slightly more medicinal than fresh, but still useful in spice blends and cooked applications. Essential in Middle Eastern cooking — in spice mixes, meat dishes, tabbouleh, and teas. Spearmint is the primary culinary variety; peppermint is stronger and better for beverages.",
      },
      {
        name: 'Savory',
        origin: 'Mediterranean',
        description: "An underused herb with a flavor between thyme and marjoram — slightly peppery, earthy, and savory. Summer savory is milder and more delicate; winter savory is more intense and resinous. Traditional herb for bean dishes across Europe, essential in herbes de Provence, and excellent with lamb and sausages.",
      },
    ],
  },
  {
    name: 'Citrus & Floral',
    spices: [
      {
        name: 'Dried Lemon Peel',
        origin: 'Mediterranean',
        description: "Dehydrated outer lemon zest with a bright, concentrated citrus flavor. Adds lemon character to spice rubs, blends, and dishes without adding liquid. More shelf-stable than fresh zest and useful in dry applications like seasoning mixes, baked goods, and spice rubs for fish and chicken.",
      },
      {
        name: 'Dried Orange Peel',
        origin: 'Mediterranean',
        description: "Dehydrated orange zest with a bittersweet, floral, concentrated citrus quality. Used in spice blends, mulled wine, braised meats (especially duck), and baked goods. Chinese dried tangerine peel (chen pi) is a similar ingredient fundamental to Cantonese cooking and aged up to decades.",
      },
      {
        name: 'Rose Petals',
        origin: 'Middle East / India',
        description: "Dried edible rose petals and buds used in spice blends and desserts across Persian, Indian, and North African cooking. Delicate floral sweetness with a slight tartness. Essential in ras el hanout and some garam masala blends. Also used in Turkish delight, Indian sweets, and flavored teas.",
      },
      {
        name: 'Lavender',
        origin: 'France / Mediterranean',
        description: "Culinary lavender buds with an intensely floral, perfumed flavor that straddles cooking and soap if overused — tread carefully. The distinguishing ingredient in herbes de Provence. Excellent in honey, baked goods, rubs for lamb, and lemonade. Use sparingly; it can easily overwhelm a dish.",
      },
      {
        name: 'Hibiscus',
        origin: 'West Africa / Mexico',
        description: "Dried hibiscus flowers (Hibiscus sabdariffa) with a tart, cranberry-like flavor and vivid crimson color. Used in agua fresca, teas, and cocktails across Mexico, Africa, and the Caribbean. Increasingly used in savory cooking — as a spice rub for duck, in braising liquids, and as a souring agent.",
      },
      {
        name: 'Kaffir Lime Leaf',
        origin: 'Southeast Asia',
        description: "Dried double-lobed leaves from the kaffir lime tree with an intensely citrusy, floral aroma found nowhere else in the spice world. Fundamental to Thai, Indonesian, and Cambodian cooking. Used to perfume curries, soups, and stir-fries. Remove before eating — the texture is leathery.",
      },
    ],
  },
  {
    name: 'Blends',
    spices: [
      {
        name: 'Garam Masala',
        origin: 'India',
        description: "A warming North Indian spice blend whose name translates to 'hot spices' — hot in the Ayurvedic sense (warming to the body), not spicy. Used as a finishing spice added at the end of cooking or sprinkled over the finished dish. Recipes vary by region and household but typically include cinnamon, cardamom, clove, cumin, coriander, and black pepper.",
      },
      {
        name: "Za'atar",
        origin: 'Middle East',
        description: "A Middle Eastern herb blend and condiment combining dried thyme or hyssop, sumac, sesame seeds, and salt. Proportions vary by country and family — Lebanese za'atar is thyme-forward, Palestinian is more sumac-heavy. Eaten with olive oil and bread, scattered over hummus, rubbed on chicken. One of the most versatile blends in existence.",
      },
      {
        name: 'Herbes de Provence',
        origin: 'France',
        description: "A classic French blend from the Provence region combining thyme, rosemary, oregano, marjoram, and — traditionally — lavender. The lavender distinguishes it from Italian seasoning and makes it distinctly southern French. Used for grilling meats, roasting chicken, and seasoning vegetables in the Provençal tradition.",
      },
      {
        name: 'Ras el Hanout',
        origin: 'North Africa',
        description: "A complex North African spice blend whose name means 'top of the shop' — the best spices available. Contains anywhere from 10 to 30 ingredients including rose petals, cinnamon, cumin, coriander, and sometimes saffron. The blend varies by vendor and region. Used in Moroccan tagines, couscous, and meat dishes.",
      },
      {
        name: 'Chinese Five Spice',
        origin: 'China',
        description: "A Chinese spice blend balancing five flavors — sweet, sour, bitter, pungent, and salty — reflecting Taoist philosophy. Usually contains star anise, cloves, cinnamon, Szechuan pepper, and fennel seeds. The defining flavor of Chinese BBQ pork (char siu), red-braised meats, and many Cantonese and Sichuan preparations.",
      },
      {
        name: 'Old Bay',
        origin: 'USA',
        description: "An American spice blend created in Baltimore in 1939, built around celery salt, paprika, black pepper, cayenne, and about a dozen other spices. The definitive seasoning for Maryland crab and seafood boils. Also excellent on popcorn, french fries, fried chicken, and eggs. Intensely regional but universally beloved.",
      },
      {
        name: 'Berbere',
        origin: 'Ethiopia',
        description: "The foundational spice blend of Ethiopian cooking, combining dried chilies, fenugreek, ginger, coriander, and a range of warm spices. Complex, hot, and deeply aromatic. Used in doro wat (Ethiopian chicken stew), misir wat (lentils), and as a spice rub for meats. Every household has its own variation.",
      },
      {
        name: 'Baharat',
        origin: 'Middle East',
        description: "Arabic for 'spices,' baharat is the all-purpose warming spice blend of the Arab world. Typically includes black pepper, coriander, cinnamon, cloves, cumin, cardamom, and nutmeg. Used in rice dishes like kabsa, meatballs (kafta), soups, and stews across the entire Middle East. Warmth and depth without heat.",
      },
      {
        name: 'Curry Powder',
        origin: 'Britain (via India)',
        description: "A British colonial invention — an attempt to standardize a complex tradition into a single blend. Typically contains turmeric, cumin, coriander, chili, and fenugreek. Convenient but reductive; authentic Indian cooking uses individual spices or regional blends. Still useful for quick applications and as a solid starting point.",
      },
      {
        name: 'Jerk Seasoning',
        origin: 'Jamaica',
        description: "A Jamaican spice blend built around allspice and scotch bonnet peppers, with thyme, garlic, cinnamon, and other aromatics. Traditionally used as a wet marinade for meats cooked low and slow over pimento wood. The balance of heat, sweet allspice, and savory thyme creates a flavor profile that's entirely Caribbean.",
      },
      {
        name: 'Chaat Masala',
        origin: 'India',
        description: "An Indian spice blend with a distinctively tangy, sour, and savory flavor from amchur (dry mango), black salt (kala namak), cumin, and coriander. The sulfurous black salt gives it an unmistakably eggy-savory edge. Sprinkled on street foods, fruits, yogurt, and salads. Nothing else tastes quite like it.",
      },
      {
        name: 'Shichimi',
        origin: 'Japan',
        description: "Japanese seven-spice blend (shichimi togarashi) combining red chili, sansho pepper (a relative of Szechuan pepper), sesame, dried orange peel, ginger, nori, and poppy seeds. Used as a table condiment on noodles, soups, grilled meats, and rice dishes. Adds complex heat with citrus and floral notes.",
      },
      {
        name: 'Dukkah',
        origin: 'Egypt',
        description: "An Egyptian nut and spice blend of toasted hazelnuts or pistachios, sesame seeds, coriander, and cumin. Coarser in texture than most spice blends — more of a crumble than a powder. Eaten with bread and olive oil, scattered over eggs, salads, and roasted vegetables. Increasingly common in Western cooking.",
      },
      {
        name: 'Panch Phoron',
        origin: 'Bangladesh / Bengal',
        description: "A Bengali five-spice blend of whole seeds: cumin, mustard, fenugreek, nigella, and fennel. Unlike most blends, it's used whole and tempered in hot oil at the start of cooking. The defining aromatic base of Bengali and Bangladeshi cooking — vegetables, fish, and lentils all start with these seeds crackling in oil.",
      },
    ],
  },
]

export default function SpiceTable() {
  const [active, setActive] = useState(null)

  return (
    <div className="spice-table-wrapper">
      <div
        className="spice-grid"
        onMouseLeave={() => setActive(null)}
      >
        {GROUPS.map(group => (
          <Fragment key={group.name}>
            <div className="spice-group-header">{group.name}</div>
            {group.spices.map(spice => (
              <div
                key={spice.name}
                className={`spice-cell${active?.name === spice.name ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(spice)}
              >
                <span className="spice-name">{spice.name}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      <div className="spice-detail">
        {active ? (
          <>
            <div className="spice-detail-header">
              <strong>{active.name}</strong>
              <span className="spice-detail-origin">{active.origin}</span>
            </div>
            <p className="spice-detail-desc">{active.description}</p>
          </>
        ) : (
          <span className="spice-detail-hint">Hover over a spice to see details</span>
        )}
      </div>
    </div>
  )
}
