-- ============================================================================
-- Allturf CRM — Seed Data
-- Run AFTER schema.sql on a fresh Supabase project
-- ============================================================================

-- ============================================================================
-- 1. TURF DISEASES & PESTS (~15 common Ontario issues)
-- Data sourced from GTI Fact Sheets, OMAFRA Pub 845, and Ontario IPM research
-- ============================================================================

INSERT INTO turf_diseases_pests (
  id, name, type, scientific_name, symptoms,
  affected_grass_types, affected_areas,
  season_start, season_end,
  optimal_temp_min_c, optimal_temp_max_c,
  humidity_factor, severity, cultural_controls,
  ontario_common
) VALUES

-- DISEASES (10)

(gen_random_uuid(), 'Dollar Spot', 'Disease',
 'Clarireedia jacksonii',
 'Straw-coloured circular patches approximately the size of a loonie on short turf. Patches can be larger (up to 15 cm) on taller grass. White cobweb-like mycelium visible with morning dew. Hourglass-shaped lesions on individual leaf blades. Patches may coalesce into larger blighted areas.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue','Poa annua'],
 ARRAY['Greens','Fairways','Tees'],
 'May', 'October',
 15, 30, 'High humidity with prolonged leaf wetness; dew formation critical',
 'High — most destructive and costly turfgrass disease in North America',
 'Maintain consistent light nitrogen applications. Increase airflow and sun exposure. Water deeply and infrequently, avoid evening irrigation. Remove dew by mowing, rolling, or poling in the morning. Select resistant cultivars (consult NTEP). Verticutting, aerating, or overseeding with resistant cultivars for large damaged areas.',
 true),

(gen_random_uuid(), 'Gray Snow Mold', 'Disease',
 'Typhula incarnata / Typhula ishikariensis',
 'Circular patches of bleached, matted turf visible after snow melt. Grayish-white mycelium on leaf surfaces. Small dark brown or black sclerotia (0.5-3mm) embedded in leaf tissue. Patches range from 5-30 cm diameter. Turf appears water-soaked and matted.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue','Poa annua'],
 ARRAY['Greens','Fairways','Tees','Rough'],
 'November', 'April',
 -5, 5, 'Requires prolonged snow cover (60+ days); high moisture under snow',
 'High — critical Ontario winter disease requiring late-fall preventive fungicide',
 'Minimize thatch accumulation. Avoid late-fall nitrogen that promotes succulent growth. Improve drainage. Reduce snow cover duration in late winter/early spring where possible. Apply preventive fungicide before permanent snow cover (late October/early November).',
 true),

(gen_random_uuid(), 'Pink Snow Mold', 'Disease',
 'Microdochium nivale',
 'Small yellow patches during cool wet weather expanding to 5-20 cm. Pinkish or orange colour along outer edges. Interior appears sunken and straw-coloured. White or pink cottony mycelium visible under cool moist conditions. "Frog eye" symptom as centers recover. Bronze-coloured edges in cool wet weather with sunlight.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Greens','Fairways','Tees'],
 'October', 'May',
 0, 8, 'Thrives in cool wet conditions; active with or without snow cover',
 'High — can cause severe damage to large areas if untreated; rarely kills grass',
 'Maximize plant health with balanced fertility and optimized drainage. Limit thatch. Promote good airflow and direct sunlight. Reduce leaf wetness by dew dragging and rolling. Avoid late-fall nitrogen. Select resilient cultivars. Plug out small patches on greens. Limit snow cover in late winter.',
 true),

(gen_random_uuid(), 'Pythium Blight', 'Disease',
 'Pythium aphanidermatum / Pythium ultimum',
 'Greasy, dark, water-soaked patches appearing suddenly. Cottony white mycelium visible in early morning. Patches follow drainage patterns in streaks. Rapidly expanding irregular areas. Turf collapses quickly in hot humid conditions. Diffused yellowing with root and crown rot.',
 ARRAY['Bentgrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Greens','Fairways','Tees'],
 'June', 'September',
 25, 35, 'Very high humidity; saturated conditions; poor drainage critical factor',
 'Critical — can devastate turf within 24-48 hours in favourable conditions',
 'Improve drainage and air circulation. Avoid excessive nitrogen. Frequent light watering rather than heavy irrigation. Reduce thatch. Avoid mowing wet turf. Ensure proper soil structure.',
 true),

(gen_random_uuid(), 'Brown Patch', 'Disease',
 'Rhizoctonia solani',
 'Light brown circular patches 15 cm to several metres in diameter. Purple-brown "smoke ring" border visible during heavy dew in early morning. Interior turf may recover giving donut-shaped appearance. Leaf lesions with tan centers and dark brown borders.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Tall Fescue'],
 ARRAY['Greens','Fairways','Tees','Rough'],
 'June', 'September',
 24, 32, 'High humidity with temperatures above 24°C; night temps above 20°C critical',
 'High — favoured by warm humid Ontario summers and excess nitrogen',
 'Reduce shade and increase air circulation. Light watering at 10 a.m. and 2 p.m. to cool turf. Avoid excessive nitrogen during summer. Improve drainage. Raise mowing height during heat stress.',
 true),

(gen_random_uuid(), 'Fairy Ring', 'Disease',
 'Various basidiomycete fungi (50+ species)',
 'Rings or arcs of dark green, stimulated grass growth. Mushrooms or puffballs may appear along ring margin. Inner area may show dead or hydrophobic turf. Three types: Type I (dead zone), Type II (stimulated ring), Type III (mushroom ring only).',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Greens','Fairways','Rough'],
 'May', 'October',
 15, 30, 'Moderate humidity; organic matter decomposition drives fungal growth',
 'Moderate — primarily aesthetic but Type I can kill turf',
 'Core aeration to break hydrophobic soil layer. Deep watering with wetting agent to penetrate thatch. Mask symptoms with nitrogen fertilization. Remove organic debris (stumps, roots) during construction. Soil fumigation for severe Type I cases.',
 true),

(gen_random_uuid(), 'Anthracnose', 'Disease',
 'Colletotrichum cereale',
 'Irregular yellow to bronze patches. Basal rot of crowns and stolons. Small black acervuli (spore-producing structures) visible with hand lens. Turf thins progressively under stress. Yellowing and decline of individual plants.',
 ARRAY['Bentgrass','Poa annua'],
 ARRAY['Greens','Tees'],
 'June', 'September',
 25, 35, 'Stress-related; favoured by heat, drought, compaction, low mowing',
 'High — significant on stressed annual bluegrass greens',
 'Reduce compaction through regular aeration. Minimize thatch. Avoid excessive stress from low mowing heights. Maintain adequate nitrogen and potassium. Ensure proper irrigation during heat stress. Reduce traffic on stressed turf.',
 true),

(gen_random_uuid(), 'Summer Patch', 'Disease',
 'Magnaporthe poae',
 'Circular patches 15-30 cm diameter of wilted, straw-coloured turf. Patches may have green, unaffected grass in center (frog-eye pattern). Roots, stolons, and crowns show dark brown to black discolouration. Symptoms appear during summer heat but root infection begins in spring.',
 ARRAY['Kentucky Bluegrass','Fine Fescue','Poa annua'],
 ARRAY['Fairways','Tees','Rough'],
 'June', 'August',
 28, 35, 'Root infection starts in spring at soil temps above 18°C; symptoms in summer heat',
 'Moderate — difficult to control once symptoms appear; preventive approach needed',
 'Improve drainage and reduce soil compaction. Avoid excessive nitrogen in spring. Raise mowing height. Core aerate in spring. Consider overseeding with resistant species (perennial ryegrass, tall fescue). Acidify soil if pH is above 6.5.',
 true),

(gen_random_uuid(), 'Red Thread', 'Disease',
 'Laetisaria fuciformis',
 'Irregular patches of tan or pink turf. Pink to red thread-like mycelium (sclerotia) extending from leaf tips. Gelatinous pink masses on leaves. Patches 5-30 cm diameter. No crown or root damage.',
 ARRAY['Perennial Ryegrass','Fine Fescue','Kentucky Bluegrass'],
 ARRAY['Fairways','Rough','Tees'],
 'May', 'October',
 15, 25, 'Cool humid weather with prolonged leaf wetness',
 'Low — primarily cosmetic; turf recovers with nitrogen application',
 'Apply nitrogen to stimulate growth and recovery. Improve air circulation. Avoid evening irrigation. Maintain adequate fertility program. Overseed with resistant cultivars.',
 true),

(gen_random_uuid(), 'Leaf Spot / Melting Out', 'Disease',
 'Bipolaris sorokiniana / Drechslera poae',
 'Small dark brown to purple leaf spots with tan centers. Spots enlarge and coalesce causing leaf blight. Crown and root rot phase ("melting out") in hot weather. Thinning and irregular brown patches. Individual blades show distinct lesions.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Bentgrass'],
 ARRAY['Fairways','Tees','Rough'],
 'April', 'September',
 20, 30, 'Cool wet spring weather triggers leaf spot; hot stress triggers melting out',
 'Moderate — leaf spot phase is manageable; melting out phase can be severe',
 'Raise mowing height. Avoid excessive nitrogen in spring. Improve drainage and air circulation. Overseed with resistant Kentucky bluegrass cultivars. Reduce thatch. Water deeply and infrequently.',
 true),

-- PESTS (3)

(gen_random_uuid(), 'White Grubs (European Chafer)', 'Pest',
 'Amphimallon majale',
 'Irregular brown patches of wilted turf that lifts easily from soil. C-shaped white larvae in root zone. Turf feels spongy. Secondary damage from skunks, raccoons, and birds digging for grubs. Most severe in late summer and fall.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Fairways','Rough','Tees'],
 'July', 'October',
 15, 25, 'Moderate soil moisture; eggs laid in June-July; damage peaks August-October',
 'High — Ontario threshold: >20/0.1m² irrigated turf; >5-10/0.1m² non-irrigated',
 'Maintain healthy dense turf. Irrigate during dry periods to reduce egg-laying preference. Core aerate to reduce compaction. Consider endophyte-enhanced cultivars. Overseed damaged areas in fall. Reduce irrigation in June-July to deter egg laying.',
 true),

(gen_random_uuid(), 'Chinch Bugs', 'Pest',
 'Blissus leucopterus hirtus',
 'Irregular patches of yellowing and browning turf, often starting near pavement edges and sunny slopes. Turf appears drought-stressed but does not recover with watering. Adults are small (3-4mm) black insects with white wings. Nymphs are red-orange.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Fairways','Rough'],
 'June', 'September',
 25, 35, 'Hot dry conditions; south-facing slopes most vulnerable',
 'Moderate — Ontario threshold: >20 per cylinder/0.1m²',
 'Maintain adequate irrigation to reduce stress. Overseed with endophyte-enhanced cultivars (perennial ryegrass, fine fescue). Reduce thatch buildup. Improve soil health. Adequate irrigation minimizes damage.',
 true),

(gen_random_uuid(), 'Annual Bluegrass Weevil', 'Pest',
 'Listronotus maculicollis',
 'Small circular dead patches on closely mowed turf. Turf yellows and thins progressively. Larvae feed inside stems (early instars) then on crowns (later instars). Most severe on annual bluegrass. Adults are small (3-4mm) dark snout beetles.',
 ARRAY['Poa annua','Bentgrass'],
 ARRAY['Greens','Tees','Fairways'],
 'May', 'September',
 15, 30, 'Adults overwinter in rough and leaf litter; migrate to short turf in spring',
 'High — severe pest on annual bluegrass greens and fairways in Ontario',
 'Monitor adult migration in spring using pitfall traps. Time applications to adult migration (degree-day models). Reduce annual bluegrass populations through overseeding with bentgrass. Manage rough and leaf litter to reduce overwintering sites.',
 true),

-- WEEDS (2)

(gen_random_uuid(), 'Crabgrass', 'Weed',
 'Digitaria sanguinalis / Digitaria ischaemum',
 'Coarse-textured annual grass forming spreading clumps. Light green to yellow-green colour contrasting with turf. Low-growing with stems that root at nodes. Seed heads appear in late summer. Dies with first frost leaving bare patches.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Fairways','Tees','Rough'],
 'May', 'October',
 20, 35, 'Germinates when soil temperature reaches 13-15°C for 3-5 consecutive days',
 'Moderate — primarily aesthetic; pre-emergent timing critical',
 'Maintain dense healthy turf to prevent establishment. Mow at proper height to shade soil. Pre-emergent herbicide application when soil temps reach 10-12°C. Overseed bare areas in fall. Avoid spring core aeration that creates openings.',
 true),

(gen_random_uuid(), 'Broadleaf Plantain', 'Weed',
 'Plantago major',
 'Rosette of broad, oval leaves with prominent parallel veins. Tolerates very low mowing. Flower spikes with small greenish flowers. Reproduces by seed. Thrives in compacted, poorly drained soils. Indicator of soil compaction.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue','Bentgrass'],
 ARRAY['Fairways','Tees','Rough','Greens'],
 'April', 'October',
 10, 30, 'Tolerates wide range of conditions; indicator of soil compaction',
 'Low — controlled culturally through compaction relief and dense turf',
 'Core aerate to relieve soil compaction. Maintain dense vigorous turf. Hand-pull individual plants before seed set. Overseed bare areas. Iron HEDTA (Fiesta) for targeted control on Ontario golf courses.',
 true);

-- ============================================================================
-- 2. SAMPLE PRODUCTS (offerings) — 10 common Ontario turf products
-- PCP registration numbers sourced from PMRA label database where available.
-- Any unverified numbers marked as PLACEHOLDER.
-- ============================================================================

INSERT INTO offerings (
  id, name, description, price, category, is_active,
  manufacturer, active_ingredients,
  pcp_registration_number,
  application_rate_min, application_rate_max, application_rate_unit,
  target_diseases, target_pests,
  compatible_tank_mixes, seasonal_availability,
  re_entry_interval_hours, rain_fast_hours,
  signal_word, mode_of_action, moa_group,
  ontario_class
) VALUES

-- 1. Banner MAXX (Propiconazole)
(gen_random_uuid(), 'Banner MAXX', 'Broad-spectrum DMI fungicide for dollar spot, brown patch, and snow mould control on golf course turf.',
 485.00, 'Fungicide', true,
 'Syngenta', ARRAY['Propiconazole'],
 '24353',
 1.6, 3.2, 'L/ha',
 ARRAY['Dollar Spot','Brown Patch','Gray Snow Mold','Pink Snow Mold','Fairy Ring','Anthracnose','Red Thread','Leaf Spot / Melting Out','Summer Patch'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 24, 2,
 'Caution', 'Demethylation inhibitor — inhibits ergosterol biosynthesis in fungal cell membranes', 'Group 3 (DMI)',
 'Class 2'),

-- 2. Heritage (Azoxystrobin)
(gen_random_uuid(), 'Heritage', 'QoI/strobilurin fungicide providing preventive and early curative control of major turf diseases.',
 620.00, 'Fungicide', true,
 'Syngenta', ARRAY['Azoxystrobin'],
 '27516',
 0.3, 0.6, 'kg/ha',
 ARRAY['Dollar Spot','Brown Patch','Anthracnose','Pythium Blight','Gray Snow Mold','Pink Snow Mold','Red Thread','Leaf Spot / Melting Out','Summer Patch','Fairy Ring'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 4, 1,
 'Caution', 'Quinone outside Inhibitor — blocks mitochondrial respiration at Complex III', 'Group 11 (QoI/Strobilurin)',
 'Class 2'),

-- 3. Primo MAXX (Trinexapac-ethyl)
(gen_random_uuid(), 'Primo MAXX', 'Plant growth regulator that reduces vertical growth, increases density and lateral growth, and improves turf quality.',
 295.00, 'Growth Regulator', true,
 'Syngenta', ARRAY['Trinexapac-ethyl'],
 '28198',
 0.4, 1.6, 'L/ha',
 NULL, NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 0, 1,
 'Caution', 'Gibberellin biosynthesis inhibitor — reduces cell elongation', NULL,
 'Class 6'),

-- 4. Pillar G (Triticonazole + Pyraclostrobin)
(gen_random_uuid(), 'Pillar G', 'Granular combination fungicide providing broad-spectrum disease control with two modes of action for resistance management.',
 520.00, 'Fungicide', true,
 'BASF', ARRAY['Triticonazole','Pyraclostrobin'],
 '30515',
 1.5, 3.0, 'kg/100m²',
 ARRAY['Dollar Spot','Brown Patch','Gray Snow Mold','Pink Snow Mold','Anthracnose','Leaf Spot / Melting Out'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 24, 0,
 'Caution', 'DMI + QoI dual mode — inhibits ergosterol biosynthesis and mitochondrial respiration', 'Multiple',
 'Class 2'),

-- 5. Acelepryn (Chlorantraniliprole)
(gen_random_uuid(), 'Acelepryn', 'Reduced-risk insecticide for preventive control of white grubs, annual bluegrass weevil, and other turf insects with low environmental impact.',
 780.00, 'Insecticide', true,
 'Syngenta', ARRAY['Chlorantraniliprole'],
 '29080',
 1.2, 2.5, 'L/ha',
 NULL,
 ARRAY['White Grubs (European Chafer)','Annual Bluegrass Weevil','Chinch Bugs'],
 NULL,
 ARRAY['Spring','Summer'],
 4, 1,
 'Caution', 'Ryanodine receptor modulator — disrupts calcium channels in insect muscles', 'Group 28 (Carbamate)',
 'Class 4'),

-- 6. Instrata (Chlorothalonil + Fludioxonil + Propiconazole)
(gen_random_uuid(), 'Instrata', 'Triple-mode-of-action fungicide combining contact and systemic activity for comprehensive disease management.',
 550.00, 'Fungicide', true,
 'Syngenta', ARRAY['Chlorothalonil','Fludioxonil','Propiconazole'],
 '29928',
 6.0, 13.0, 'L/ha',
 ARRAY['Dollar Spot','Brown Patch','Gray Snow Mold','Pink Snow Mold','Anthracnose','Red Thread'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 48, 2,
 'Warning', 'Multi-site contact + phenylpyrrole + DMI triple mode — broad resistance management', 'Multiple',
 'Class 2'),

-- 7. Bravo (Chlorothalonil)
(gen_random_uuid(), 'Bravo', 'Multi-site contact fungicide providing broad-spectrum disease control. PMRA restricted: max 2 foliar + 1 fall application per season (May 2020).',
 175.00, 'Fungicide', true,
 'Syngenta', ARRAY['Chlorothalonil'],
 '28906',
 5.5, 11.0, 'L/ha',
 ARRAY['Dollar Spot','Brown Patch','Gray Snow Mold','Pink Snow Mold','Anthracnose','Leaf Spot / Melting Out','Red Thread'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 48, 2,
 'Danger', 'Multi-site contact — disrupts multiple metabolic processes in fungi', 'Group M5 (Chloronitrile)',
 'Class 2'),

-- 8. Eagle (Myclobutanil)
(gen_random_uuid(), 'Eagle', 'Systemic DMI fungicide with preventive and curative activity against dollar spot, brown patch, and snow moulds.',
 410.00, 'Fungicide', true,
 'Dow AgroSciences', ARRAY['Myclobutanil'],
 '24452',
 0.9, 1.8, 'kg/ha',
 ARRAY['Dollar Spot','Brown Patch','Gray Snow Mold','Pink Snow Mold','Anthracnose','Summer Patch','Red Thread'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 24, 2,
 'Caution', 'Demethylation inhibitor — inhibits ergosterol biosynthesis', 'Group 3 (DMI)',
 'Class 2'),

-- 9. Medallion (Fludioxonil)
(gen_random_uuid(), 'Medallion', 'Contact fungicide with unique phenylpyrrole mode of action for snow mould and brown patch control. Excellent rotation partner.',
 590.00, 'Fungicide', true,
 'Syngenta', ARRAY['Fludioxonil'],
 '28622',
 0.6, 1.0, 'kg/ha',
 ARRAY['Gray Snow Mold','Pink Snow Mold','Brown Patch','Dollar Spot'],
 NULL,
 NULL,
 ARRAY['Fall','Spring'],
 12, 1,
 'Caution', 'Phenylpyrrole — inhibits transport-associated phosphorylation of glucose', 'Group 12 (Phenylpyrrole)',
 'Class 2'),

-- 10. Civitas
(gen_random_uuid(), 'Civitas', 'Plant defence activator / biological fungicide that induces systemic acquired resistance. Gaining traction as rotational partner in Ontario IPM programs.',
 320.00, 'Fungicide', true,
 'Petro-Canada Lubricants', ARRAY['Mineral oil','Isopropylamine'],
 '30041',
 30.0, 60.0, 'L/ha',
 ARRAY['Dollar Spot','Brown Patch','Anthracnose','Pink Snow Mold','Gray Snow Mold'],
 NULL,
 NULL,
 ARRAY['Spring','Summer','Fall'],
 0, 1,
 'Caution', 'Induced systemic resistance — activates plant defence pathways', NULL,
 'Class 6');


-- ============================================================================
-- 3. PRODUCT-DISEASE LINKS
-- Link products to target diseases/pests with efficacy ratings
-- ============================================================================

-- We need to reference IDs from the inserts above, so use subqueries
-- Banner MAXX links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Primary DMI for dollar spot control in Ontario'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Curative and preventive activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', true, 'Apply before permanent snow cover'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', true, 'Apply before permanent snow cover'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Pink Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Good curative activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Anthracnose';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'DMI class effective on summer patch'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Banner MAXX' AND d.name = 'Summer Patch';

-- Heritage links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Preventive only; resistance concerns with solo use'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Strong preventive and early curative'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Fall preventive application'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Fall preventive application'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Pink Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Strong QoI activity against anthracnose'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Anthracnose';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Effective against Pythium species'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Pythium Blight';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Broad-spectrum QoI activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Heritage' AND d.name = 'Fairy Ring';

-- Pillar G links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Dual MOA granular for dollar spot; resistance management advantage'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Pillar G' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Good preventive and curative activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Pillar G' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Apply as granular before snow cover'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Pillar G' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Apply as granular before snow cover'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Pillar G' AND d.name = 'Pink Snow Mold';

-- Acelepryn links (insecticide)
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Primary reduced-risk grub control; apply preventively May-July'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Acelepryn' AND d.name = 'White Grubs (European Chafer)';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Time application to adult migration using degree-day models'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Acelepryn' AND d.name = 'Annual Bluegrass Weevil';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Supplemental control of chinch bugs'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Acelepryn' AND d.name = 'Chinch Bugs';

-- Instrata links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Triple MOA provides exceptional dollar spot control and resistance management'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Instrata' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Strong activity against brown patch'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Instrata' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Excellent snow mould prevention'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Instrata' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Excellent snow mould prevention'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Instrata' AND d.name = 'Pink Snow Mold';

-- Bravo links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Multi-site contact; PMRA restricted max 2 foliar + 1 fall/season'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', true, 'Strong broad-spectrum contact activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Key tank mix partner for snow mould programs'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Key tank mix partner for snow mould programs'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Pink Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Good preventive contact activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Anthracnose';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Multi-site prevents leaf spot progression'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Bravo' AND d.name = 'Leaf Spot / Melting Out';

-- Eagle links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Systemic DMI with curative activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Eagle' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Good preventive and curative control'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Eagle' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Apply before snow cover'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Eagle' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Strong DMI for summer patch prevention'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Eagle' AND d.name = 'Summer Patch';

-- Medallion links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Primary snow mould control product; excellent rotation partner'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Medallion' AND d.name = 'Gray Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Excellent', true, 'Primary snow mould control; unique Group 12 MOA'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Medallion' AND d.name = 'Pink Snow Mold';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Good', false, 'Good activity against brown patch'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Medallion' AND d.name = 'Brown Patch';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Fair', false, 'Supplemental dollar spot control'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Medallion' AND d.name = 'Dollar Spot';

-- Civitas links
INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Fair', false, 'ISR-based suppression; best as rotational partner'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Civitas' AND d.name = 'Dollar Spot';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Fair', false, 'Supplemental ISR activity'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Civitas' AND d.name = 'Anthracnose';

INSERT INTO product_disease_links (product_id, disease_pest_id, efficacy, is_primary, notes)
SELECT o.id, d.id, 'Preventive Only', false, 'ISR activation for preventive snow mould suppression'
FROM offerings o, turf_diseases_pests d
WHERE o.name = 'Civitas' AND d.name = 'Pink Snow Mold';


-- ============================================================================
-- 4. TURF KNOWLEDGE BASE (~50 entries)
-- Sourced from GTI Fact Sheets, OMAFRA Pub 845, and Ontario IPM research
-- ============================================================================

INSERT INTO turf_knowledge_base (category, title, content, symptoms, conditions, grass_types, seasonal_relevance, keywords, source) VALUES

-- DISEASE PROFILES (15)
('disease', 'Dollar Spot — Identification and Management',
 'Dollar spot (Clarireedia jacksonii) is the most destructive and costly turfgrass disease in North America. It thrives in warm, humid conditions (15-30°C) with prolonged leaf wetness. Low nitrogen fertility, drought stress, and poor air circulation increase susceptibility. Fungicide resistance is a persistent issue — multiple MOA groups must be rotated in IPM programs. PMRA-registered DMI, QoI, SDHI, and multi-site contact fungicides are available. Ontario courses typically apply 6-10 fungicide applications per season targeting dollar spot.',
 'Straw-coloured circular patches the size of a loonie on short turf. Hourglass-shaped lesions on individual blades. White cobweb-like mycelium visible at dawn.',
 'Active 15-30°C with high humidity and prolonged leaf wetness. Low nitrogen and drought stress increase severity.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['dollar spot','clarireedia','fungicide','DMI','resistance','rotation','nitrogen'],
 'GTI Fact Sheet; OMAFRA Pub 845'),

('disease', 'Gray Snow Mold — Pre-Winter Prevention',
 'Gray snow mold (Typhula spp.) requires 60+ days of snow cover to develop. Sclerotia survive in thatch and soil, germinating under snow cover. Late-fall fungicide application before permanent snow cover is the single most critical turfgrass management decision for Ontario courses. Tank mixes of chlorothalonil + DMI or SDHI + Group 12 (fludioxonil) provide best protection. Avoid late-fall nitrogen that promotes succulent tissue susceptible to infection.',
 'Circular patches of bleached, matted turf after snow melt. Grayish-white mycelium on leaf surfaces. Dark brown or black sclerotia (0.5-3mm) in leaf tissue.',
 'Requires prolonged snow cover (60+ days). Active -5 to 5°C. High moisture under snow pack.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Fall','Winter'],
 ARRAY['gray snow mold','typhula','snow mould','sclerotia','winter','fall application'],
 'GTI Fact Sheet; OMAFRA Pub 845'),

('disease', 'Pink Snow Mold (Microdochium Patch) — Year-Round Threat',
 'Unlike gray snow mold, Microdochium nivale can be active with or without snow cover whenever cool wet conditions persist (0-8°C). In Ontario, it is most problematic in fall as temperatures drop and in early spring. Late-fall management is more critical than spring — failing to control in fall increases spring incidence. Biological controls (mineral oils, iron sulphate, Trichoderma spp.) show some suppression but lower efficacy than chemical fungicides.',
 'Small yellow patches expanding to 5-20 cm. Pinkish or orange margins. White or pink cottony mycelium. Bronze edges in cool wet weather.',
 'Most active 0-8°C in cool wet conditions. Can develop with or without snow cover. East coast more problematic.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Fall','Winter','Spring'],
 ARRAY['pink snow mold','microdochium','fusarium patch','fall timing','cool weather'],
 'GTI Fact Sheet'),

('disease', 'Pythium Blight — Emergency Response Protocol',
 'Pythium blight can devastate turf within 24-48 hours under ideal conditions (25-35°C, saturated soils, poor drainage). Ontario superintendents must have preventive Pythium products on hand during July-August heat events. Propamocarb (Banol), mefenoxam, and fosetyl-Al are primary active ingredients. Avoid mowing wet turf during outbreaks as equipment spreads zoospores. Drainage improvement is the most important long-term cultural practice.',
 'Greasy dark water-soaked patches appearing suddenly. Cottony white mycelium in early morning. Patches follow drainage patterns.',
 'Very high humidity with saturated conditions. Temperature 25-35°C. Poor drainage critical factor.',
 ARRAY['Bentgrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Summer'],
 ARRAY['pythium','blight','emergency','drainage','hot weather','fosetyl','propamocarb'],
 'OMAFRA Pub 845'),

('disease', 'Brown Patch — Summer Heat Management',
 'Brown patch (Rhizoctonia solani) is favoured by warm humid Ontario summers with night temperatures above 20°C. Excessive nitrogen during summer increases severity dramatically. The "smoke ring" border visible in early morning dew is diagnostic. Cultural practices (reducing shade, improving air circulation, syringing at midday) can significantly reduce disease pressure. DMI and SDHI fungicides provide good preventive control.',
 'Light brown circular patches with purple-brown smoke ring border in early morning dew. Leaf lesions with tan centers and dark brown borders.',
 'High humidity with temperatures above 24°C. Night temperatures above 20°C critical. Excess nitrogen increases severity.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Tall Fescue'],
 ARRAY['Summer'],
 ARRAY['brown patch','rhizoctonia','smoke ring','summer','night temperature','nitrogen'],
 'OMAFRA Pub 845'),

('disease', 'Anthracnose — Stress-Related Decline',
 'Anthracnose (Colletotrichum cereale) is primarily a stress-related disease affecting Poa annua and bentgrass on closely mowed greens. Heat, drought, compaction, and low mowing heights predispose turf. Management focuses on reducing stress: adequate nitrogen and potassium, proper irrigation during heat, regular aeration, and raising mowing heights during stress periods. QoI + SDHI combinations provide best fungicidal control.',
 'Irregular yellow to bronze patches. Basal rot of crowns. Small black acervuli visible with hand lens. Progressive thinning under stress.',
 'Stress-related: heat, drought, compaction, low mowing. Most severe on Poa annua greens.',
 ARRAY['Bentgrass','Poa annua'],
 ARRAY['Summer'],
 ARRAY['anthracnose','colletotrichum','stress','poa annua','basal rot','compaction'],
 'OMAFRA Pub 845'),

('disease', 'Summer Patch — Root Infection in Spring',
 'Summer patch (Magnaporthe poae) is unique because root infection begins in spring when soil temperatures exceed 18°C, but symptoms don''t appear until summer heat stress. Preventive fungicide applications must begin in spring when soil temps reach 18°C — waiting for symptoms is too late. DMI fungicides applied as drench provide best control. Acidifying soil below pH 6.5 can reduce severity.',
 'Circular wilted straw-coloured patches 15-30 cm. Frog-eye pattern with green center. Dark brown to black root discolouration.',
 'Root infection starts at soil temps >18°C in spring. Symptoms appear during summer heat stress.',
 ARRAY['Kentucky Bluegrass','Fine Fescue','Poa annua'],
 ARRAY['Spring','Summer'],
 ARRAY['summer patch','magnaporthe','root infection','spring drench','soil temperature','pH'],
 'OMAFRA Pub 845'),

('disease', 'Red Thread — Nitrogen Deficiency Indicator',
 'Red thread (Laetisaria fuciformis) is primarily an indicator of low nitrogen fertility. It rarely causes permanent damage and turf recovers quickly with nitrogen application. Chemical control is usually unnecessary — the cost of a nitrogen application is lower and addresses the underlying cause. However, persistent outbreaks on high-profile turf may warrant fungicide treatment.',
 'Irregular patches of tan or pink turf. Pink to red thread-like mycelium extending from leaf tips. Gelatinous pink masses.',
 'Cool humid weather with prolonged leaf wetness. Low nitrogen turf most susceptible.',
 ARRAY['Perennial Ryegrass','Fine Fescue','Kentucky Bluegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['red thread','laetisaria','nitrogen','fertility','cosmetic','low cost'],
 'OMAFRA Pub 845'),

('disease', 'Fairy Ring — Three Types and Management',
 'Fairy ring is caused by 50+ species of basidiomycete fungi. Type I (dead zone) is most damaging and may require soil fumigation. Type II (dark green stimulated growth) is primarily cosmetic. Type III (mushroom ring only) requires no treatment. Core aeration to break the hydrophobic soil layer, combined with deep watering with wetting agents, is the primary cultural management approach. Flutolanil and azoxystrobin provide some fungicidal control.',
 'Rings or arcs of dark green growth. Mushrooms along ring margin. Dead or hydrophobic turf in inner area (Type I).',
 'Organic matter decomposition drives fungal growth. Moderate humidity. Active 15-30°C.',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['fairy ring','mushroom','hydrophobic','wetting agent','basidiomycete','type I','type II'],
 'OMAFRA Pub 845'),

('disease', 'Leaf Spot and Melting Out — Two Phases',
 'Helminthosporium diseases have two distinct phases. The leaf spot phase (cool wet spring weather) produces visible lesions but is manageable. The melting out phase (hot weather) attacks crowns and roots, causing severe decline. Avoiding excessive spring nitrogen reduces leaf spot severity. Raising mowing height is the single most effective cultural practice. Resistant Kentucky bluegrass cultivars are available.',
 'Dark brown to purple leaf spots with tan centers. Melting out phase: crown and root rot, thinning patches.',
 'Leaf spot phase in cool wet spring. Melting out phase during hot summer stress.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Bentgrass'],
 ARRAY['Spring','Summer'],
 ARRAY['leaf spot','melting out','bipolaris','helminthosporium','mowing height','spring'],
 'OMAFRA Pub 845'),

('disease', 'Turfgrass Rust — Late Summer Management',
 'Rust (Puccinia spp.) is generally cosmetic but can be severe on slow-growing, nitrogen-deficient turf. The orange spores transfer to clothing and equipment, which is the primary concern. Promoting growth through light nitrogen applications allows turf to outgrow symptoms. Fungicide control is rarely needed except on high-profile turf. Infection begins in spring but symptoms appear in late summer. Removing alternate host plants (woody species) in surrounding areas reduces inoculum.',
 'Yellow flecks expanding to raised orange or brown pustules. Orange spores transfer to clothing. Leaf tip dieback progressing to necrosis.',
 'Active in late summer to early fall. High temperatures over 16°C. Long dew periods >10 hours. Drought stress.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Summer','Fall'],
 ARRAY['rust','puccinia','orange','spores','nitrogen','cosmetic','late summer'],
 'GTI Fact Sheet'),

-- PEST PROFILES (4)
('pest', 'White Grubs — European Chafer Management in Ontario',
 'European chafer is the dominant white grub species on Ontario golf courses. Adults fly and mate in late June, laying eggs in soil. Grubs feed on roots July-October, with damage peaking in late summer. Action threshold: >20 grubs per 0.1m² on irrigated turf, 5-10 on non-irrigated. Reducing irrigation in June-July deters egg-laying. Chlorantraniliprole (Acelepryn) is the primary reduced-risk option. Neonicotinoid use is declining due to pollinator concerns.',
 'Irregular brown patches of wilted turf that lifts easily. C-shaped white larvae in root zone. Secondary wildlife damage.',
 'Eggs laid June-July. Damage peaks August-October. Moderate soil moisture.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Summer','Fall'],
 ARRAY['white grubs','european chafer','acelepryn','chlorantraniliprole','threshold','root feeding'],
 'OMAFRA Pub 845; Ontario IPM research'),

('pest', 'Annual Bluegrass Weevil — Degree-Day Based Management',
 'ABW is a severe pest on annual bluegrass greens and fairways. Adults overwinter in rough and leaf litter, migrating to short turf in spring. Degree-day models are used to time applications to adult migration (approximately 200-300 GDD base 10°C). Early instar larvae feed inside stems, later instars feed on crowns causing turf death. Reducing Poa annua populations through overseeding with bentgrass is the most sustainable long-term strategy.',
 'Small circular dead patches on closely mowed turf. Progressive yellowing and thinning. Small dark snout beetles (3-4mm).',
 'Adults migrate to short turf in spring. Larvae feed May-September. Degree-day timing critical.',
 ARRAY['Poa annua','Bentgrass'],
 ARRAY['Spring','Summer'],
 ARRAY['annual bluegrass weevil','ABW','listronotus','degree day','GDD','poa annua','migration'],
 'OMAFRA Pub 845'),

('pest', 'Chinch Bug — Heat and Drought Association',
 'Hairy chinch bugs cause damage resembling drought stress, particularly on south-facing slopes and along pavement edges where temperatures are highest. Damage does not recover with irrigation (unlike true drought stress). Action threshold: >20 per cylinder/0.1m². Endophyte-enhanced perennial ryegrass and fine fescue cultivars provide excellent natural resistance. Adequate irrigation during hot dry periods minimizes damage by maintaining turf health.',
 'Irregular yellowing and browning patches, often near pavement edges. Turf appears drought-stressed but does not recover with watering.',
 'Hot dry conditions. South-facing slopes most vulnerable. Active June-September.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Summer'],
 ARRAY['chinch bug','blissus','hairy chinch','drought','south-facing','endophyte','irrigation'],
 'OMAFRA Pub 845'),

('pest', 'Crabgrass — Pre-Emergent Timing with Soil Temperature',
 'Crabgrass germination is triggered when soil temperatures reach 13-15°C for 3-5 consecutive days, typically mid to late May in Ontario. Pre-emergent herbicides must be applied before germination — target soil temps of 10-12°C. Dithiopyr (Dimension) is the primary pre-emergent registered for Ontario golf courses. Maintaining dense healthy turf and mowing at proper height are the most effective long-term cultural controls.',
 'Coarse-textured annual grass forming spreading clumps. Light green to yellow-green colour. Low-growing, roots at nodes. Dies with first frost.',
 'Germinates at soil temperature 13-15°C for 3-5 days. Peak growth in summer heat. Dies at first frost.',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Spring','Summer'],
 ARRAY['crabgrass','digitaria','pre-emergent','dithiopyr','dimension','soil temperature','germination'],
 'OMAFRA Pub 845'),

-- CULTURAL PRACTICES (10)
('cultural_practice', 'Nitrogen Fertility — Disease Impact and Timing',
 'Nitrogen management directly impacts disease susceptibility. Too little nitrogen increases dollar spot and red thread. Too much increases Pythium blight, brown patch, and gray leaf spot. Ontario recommendation: 0.5 kg N/100 m² applied 4× annually as part of a balanced fertility program. This can reduce weed cover to <5% over 5 seasons. Late-fall nitrogen applications should be avoided as they promote succulent growth susceptible to snow mould.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['nitrogen','fertility','dollar spot','pythium','brown patch','timing','balanced'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Irrigation Best Practices for Disease Prevention',
 'Water deeply (2.0-2.5 cm per application) and infrequently rather than light daily irrigation. Frequent light irrigation creates shallow roots, encourages annual bluegrass, and prolongs leaf wetness (promoting disease). Water in early morning to reduce leaf wetness duration. Avoid evening irrigation. Reduce irrigation in June-July to deter European chafer egg-laying. Adequate irrigation during hot periods minimizes chinch bug damage.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['irrigation','watering','leaf wetness','deep watering','morning','drainage'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Mowing Height and Disease Management',
 'Mow as high as possible for the species and intended use. Never remove more than one-third of the leaf blade. Higher mowing heights promote deeper roots, shade soil to prevent weed germination, and reduce stress-related diseases (anthracnose, summer patch). Raising height of cut during heat stress periods is the single most effective cultural practice for disease reduction. Use mulching mowers to return clippings and recycle nutrients.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue','Tall Fescue'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['mowing','height of cut','one-third rule','stress','mulching','root depth'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Compaction Management and Aeration',
 'Soil compaction reduces root growth, promotes weeds (knotweed, plantain), and increases disease susceptibility. Hollow-tine core aeration should be performed at least once per year on all turf, more frequently on high-traffic areas and greens. Rotate goal areas and entrances to distribute traffic. Alternate mowing direction to prevent grain. Establish a closure policy during poor weather to protect turf. Spring aeration timing aligns with summer patch prevention.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Spring','Fall'],
 ARRAY['compaction','aeration','core','hollow-tine','traffic','drainage','root growth'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Thatch Management for Disease and Insect Prevention',
 'Excessive thatch (>1.5 cm) provides habitat for disease pathogens and insects, makes turf hydrophobic, and reduces pesticide penetration. Regular topdressing, core aeration, and verticutting manage thatch levels. Avoid excessive nitrogen and frequent light irrigation that promote thatch buildup. Monitor thatch depth during routine scouting. Bentgrass and Kentucky bluegrass are particularly prone to thatch accumulation.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['thatch','verticutting','topdressing','core aeration','hydrophobic','insect habitat'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Dew Management for Dollar Spot Prevention',
 'Dew on leaf surfaces provides the moisture conditions dollar spot requires for infection. Removing dew by mowing, rolling, or poling (dragging a hose or pole across the turf) in the morning is one of the most effective cultural practices for reducing dollar spot pressure. This practice is especially important on greens where the disease is most damaging. Should be performed before 10 a.m. to disrupt the infection period.',
 NULL, NULL,
 ARRAY['Bentgrass','Poa annua'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['dew','poling','rolling','morning','leaf wetness','dollar spot','prevention'],
 'GTI Fact Sheet'),

('cultural_practice', 'Overseeding with Resistant Cultivars',
 'Selecting disease-resistant turfgrass cultivars is the most sustainable long-term disease management strategy. Consult the National Turfgrass Evaluation Program (NTEP) for cultivar performance data. Endophyte-enhanced perennial ryegrass and fine fescue provide natural insect resistance. Replacing susceptible Poa annua with bentgrass reduces ABW damage. Overseeding into damaged areas in fall provides the best establishment window in Ontario.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue','Tall Fescue'],
 ARRAY['Fall'],
 ARRAY['overseeding','cultivar','resistant','NTEP','endophyte','fall seeding','establishment'],
 'OMAFRA Pub 845; GTI Fact Sheets'),

('cultural_practice', 'Scouting and Monitoring Protocols',
 'Regular scouting is the foundation of IPM. Golf greens and tees (Class A) should be scouted at least 2× per year (spring and fall), fairways (Class B) 1× per year. Methods include visual inspection, transect counting, soil sampling with cup cutters (for grubs), soap flushes (for surface insects), and flotation (for chinch bugs). Document findings on scouting forms for IPM audit compliance. Action thresholds determine when intervention is needed.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['scouting','monitoring','IPM','threshold','audit','cup cutter','soap flush','transect'],
 'OMAFRA Pub 845'),

('cultural_practice', 'Air Circulation and Shade Management',
 'Poor air circulation and excessive shade promote disease by prolonging leaf wetness and creating microclimates favourable for pathogens. Pruning or removing trees and shrubs around greens, tees, and problem areas improves airflow and sunlight penetration. Installing fans on critical greens is increasingly common. This is especially important for controlling dollar spot, brown patch, and Microdochium patch.',
 NULL, NULL,
 ARRAY['Bentgrass','Poa annua','Kentucky Bluegrass'],
 ARRAY['Spring','Summer','Fall'],
 ARRAY['air circulation','shade','tree pruning','fan','leaf wetness','microclimate','airflow'],
 'GTI Fact Sheets; OMAFRA Pub 845'),

('cultural_practice', 'Snow Mould Preparation — Fall Checklist',
 'Late October to early November is the critical window for snow mould prevention in Ontario. Checklist: (1) Apply preventive fungicide before permanent snow cover — typically a tank mix of multi-site contact + systemic. (2) Avoid late-fall nitrogen. (3) Remove leaves and organic debris from playing surfaces. (4) Raise mowing height slightly heading into winter. (5) Reduce snow cover duration in late winter where possible (snow blowing, packing). This single application is the most important turf management decision of the year.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Fall'],
 ARRAY['snow mould','fall application','checklist','timing','tank mix','chlorothalonil','preventive'],
 'GTI Fact Sheets; Ontario IPM research'),

-- REGULATION (6)
('regulation', 'Ontario Cosmetic Pesticide Ban — Golf Course Exemption',
 'Ontario''s cosmetic pesticide ban (O. Reg. 63/09) exempts golf courses under strict conditions: (1) Must register with IPM Council of Canada. (2) Must achieve IPM accreditation within 2 years of registration. (3) Annual desk review required. (4) On-site audit every 3 years. (5) Annual pesticide use report posted on IPM Council website by January 31. (6) Pesticide warning signs required (Sign F for unlisted products, Sign E for Allowable List products). Failure to maintain IPM accreditation results in loss of exemption.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall','Winter'],
 ARRAY['cosmetic ban','exemption','golf','IPM Council','accreditation','regulation 63/09','ontario'],
 'Ontario Regulation 63/09; IPM Council of Canada'),

('regulation', 'Chlorothalonil Restrictions — PMRA May 2020',
 'Health Canada PMRA restricted chlorothalonil use on golf courses effective May 2020. Maximum allowance: 2 foliar applications + 1 fall application per season. Soluble packaging mandated for all formulations. Despite restrictions, chlorothalonil remains the dominant active ingredient on Ontario courses (58% of total pesticide weight in Blue Mountain watershed analysis). Superintendents must carefully allocate applications — typically 1 early summer, 1 mid-summer, and 1 fall snow mould application.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['chlorothalonil','PMRA','restriction','maximum','foliar','fall','soluble packaging','bravo'],
 'PMRA Re-evaluation Decision RVD2018-11'),

('regulation', 'PCP Registration — Legal Requirements',
 'All pest control products used in Ontario must have a valid Pest Control Products (PCP) registration number from Health Canada PMRA. The product label is a legal document — failure to follow label directions contravenes the federal Pest Control Products Act. Using a product on a pest or site not listed on the label is illegal. Spot treatments are preferred over broadcast applications to minimize environmental impact. Choose the most selective products with lowest toxicity and shortest residual effect.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall','Winter'],
 ARRAY['PCP','registration','PMRA','label','legal','pest control products act','compliance'],
 'Pest Control Products Act (Canada)'),

('regulation', 'Bill 132 — Shift to Federal Oversight',
 'Bill 132 (2019) eliminated Ontario''s provincial Class 9 pesticide classification. All oversight shifted to Health Canada PMRA at the federal level. This means product registration, label requirements, and use restrictions are governed by federal law. Ontario''s cosmetic pesticide ban exemption for golf courses (O. Reg. 63/09) remains in effect with the IPM accreditation requirement.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall','Winter'],
 ARRAY['bill 132','class 9','provincial','federal','PMRA','classification','oversight'],
 'Ontario Bill 132 (2019)'),

('regulation', 'Neonicotinoid Phase-Out — Impact on Grub Management',
 'Clothianidin and thiamethoxam have been discontinued for use on Ontario golf courses. Imidacloprid (Merit) use is declining due to pollinator concerns, though still registered. Chlorantraniliprole (Acelepryn) and tetraniliprole (Tetrino) are the primary replacement insecticides for white grub and ABW control. Both are diamide chemistry with lower environmental risk. Superintendents should transition away from neonicotinoids where alternatives are available.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer'],
 ARRAY['neonicotinoid','phase-out','imidacloprid','clothianidin','pollinator','acelepryn','grub'],
 'Ontario IPM research; PMRA assessments'),

('regulation', 'IPM Accreditation — Required Documentation',
 'Ontario golf courses must maintain the following IPM documentation for annual desk review and triennial on-site audit: (1) Scouting forms for each inspection. (2) Staff IPM training records. (3) Sprayer calibration forms. (4) Pest Control Products Application forms documenting every application. (5) Annual Class 9 pesticide use report. (6) Audit submission checklist. IPM Certified Agent must hold Ontario Landscape Exterminator License and pass IPM exam (University of Guelph). 6 hours/year continuing education required.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall','Winter'],
 ARRAY['IPM','accreditation','audit','scouting form','calibration','documentation','certification'],
 'IPM Council of Canada; Ontario Regulation 63/09'),

-- PRODUCT TIPS (10)
('product_tip', 'MOA Rotation Strategy for Dollar Spot',
 'Dollar spot fungicide resistance is well documented. Ontario superintendents should rotate between 4 MOA groups: DMI (FRAC 3) → SDHI (FRAC 7) → QoI (FRAC 11) → Multi-site contact (FRAC M5 or 29). Never apply the same MOA group in consecutive applications. Tank mixing two different MOA groups provides additional resistance management. Document all applications for MOA tracking.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['MOA','rotation','resistance','FRAC','DMI','SDHI','QoI','dollar spot','tank mix'],
 'Ontario IPM research'),

('product_tip', 'Snow Mould Tank Mix Formulations',
 'The most effective Ontario snow mould programs use tank mixes combining modes of action: (1) Chlorothalonil (M5) + Propiconazole (3) — classic combination. (2) Instrata (M5 + 12 + 3) as a standalone triple mix. (3) Medallion (12) + Banner MAXX (3) — fludioxonil + propiconazole. (4) Pillar G (3 + 11) granular option. Apply in late October/early November before permanent snow cover. Single application timing is critical — too early reduces efficacy.',
 NULL, NULL, NULL,
 ARRAY['Fall'],
 ARRAY['snow mould','tank mix','chlorothalonil','propiconazole','instrata','medallion','fall timing'],
 'Ontario IPM research'),

('product_tip', 'Spray Window Assessment',
 'Before any pesticide application, assess spray window conditions: (1) Wind speed <15 km/h to prevent drift. (2) No rainfall forecast within the rain-fast period (product-specific, typically 1-2 hours). (3) Temperature 10-30°C for optimal uptake. (4) Avoid spraying during extreme heat (>32°C) as it can cause phytotoxicity. (5) Morning applications (before 10 a.m.) often provide best conditions. GDD-based tracking helps determine optimal biological timing.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['spray window','wind','rain fast','temperature','drift','phytotoxicity','timing','GDD'],
 'OMAFRA Pub 384; label directions'),

('product_tip', 'Chlorothalonil — Maximizing Limited Applications',
 'With PMRA''s restriction to max 2 foliar + 1 fall application per season, strategic allocation is essential. Typical Ontario approach: (1) First foliar during peak dollar spot pressure (June/July) as tank mix partner. (2) Second foliar during late summer disease pressure. (3) Fall application in snow mould tank mix. Multi-site contact activity provides excellent resistance management — save these applications for periods of highest disease pressure.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['chlorothalonil','PMRA','restriction','allocation','limited','multi-site','strategic'],
 'PMRA Re-evaluation; Ontario IPM research'),

('product_tip', 'Acelepryn Application Timing for Grubs',
 'Chlorantraniliprole (Acelepryn) works best as a preventive application. For European chafer: apply in May-June before egg-laying begins. For ABW: time to adult migration using degree-day models (200-300 GDD base 10°C). The product provides 2-4 months of residual control. Single application per season is typical. Apply with sufficient water volume to move product into root zone where grubs feed. Reduced-risk classification makes it preferred over neonicotinoids.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer'],
 ARRAY['acelepryn','chlorantraniliprole','grub','timing','preventive','degree day','reduced risk'],
 'Product label; Ontario IPM research'),

('product_tip', 'Civitas as Rotational Partner',
 'Civitas (mineral oil + isopropylamine) works by inducing systemic acquired resistance (ISR) in the plant rather than directly killing pathogens. Best used as a rotational partner with conventional fungicides to reduce selection pressure for resistance. Apply at 30-60 L/ha. Less effective as standalone treatment against heavy disease pressure. Growing acceptance in Ontario IPM programs as a low-risk complement to conventional chemistry.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['civitas','mineral oil','ISR','induced resistance','rotational','biological','low risk'],
 'Ontario IPM research'),

('product_tip', 'Growth Regulator Integration with Disease Programs',
 'Primo MAXX (trinexapac-ethyl) reduces vertical growth by 50%, increasing turf density and stress tolerance. This can indirectly reduce disease pressure by improving overall plant health. However, PGR-regulated turf produces less clipping mass, which can mask dollar spot symptoms. Monitor closely. PGR can be tank mixed with most fungicides — check label compatibility. Rebound growth after PGR wears off (3-4 weeks) can be susceptible to disease.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer'],
 ARRAY['primo maxx','PGR','growth regulator','trinexapac','density','tank mix','rebound'],
 'Product label; agronomic research'),

('product_tip', 'Fungicide Application Rate Guidelines',
 'Always apply within the label-specified rate range. Low rates provide shorter control periods and may promote resistance. High rates increase cost without proportional efficacy gains and may exceed PMRA maximums (illegal). Ontario standard: use mid-to-high label rates for preventive applications on greens (highest value turf), mid rates on fairways, and low-to-mid on roughs. Calibrate sprayers before each season and verify with the catch-test method.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['application rate','label maximum','PMRA','calibration','sprayer','rate selection','greens'],
 'PMRA label directions; OMAFRA Pub 384'),

('product_tip', 'Tank Mix Compatibility Testing',
 'Before combining products in a tank mix, verify compatibility: (1) Check product labels for listed compatible tank mix partners. (2) Perform jar test: mix products at proportional rates in a clear jar of water, let stand 15 minutes, check for separation, precipitation, or gelling. (3) Some common incompatibilities: liquid iron + fungicides can reduce efficacy; some wettable powders + emulsifiable concentrates may separate. Always add products in WALE order (Wettable powders, Agitating, Liquids, Emulsifiables).',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['tank mix','compatibility','jar test','WALE','precipitation','incompatible','mixing order'],
 'OMAFRA Pub 384; agronomic best practices'),

('product_tip', 'Fiesta (Iron HEDTA) for Broadleaf Weed Control',
 'Iron HEDTA (Fiesta) is on Ontario''s Allowable List, meaning lower regulatory burden and no posting requirements beyond standard signs. Effective on dandelion, plantain, and clover. Best results in spring and fall when weeds are actively growing. Requires 2-3 applications at 7-10 day intervals for complete control. Contact burn-down only — no systemic activity. Temperature must be above 15°C for efficacy. Cost-effective for targeted spot treatment.',
 NULL, NULL, NULL,
 ARRAY['Spring','Fall'],
 ARRAY['fiesta','iron HEDTA','broadleaf','weed','allowable list','dandelion','plantain','clover'],
 'Ontario Allowable List; product label'),

-- SEASONAL TIMING (5)
('cultural_practice', 'Spring Startup Checklist (April-May)',
 'Critical spring tasks for Ontario golf courses: (1) Assess winter damage — document snow mould patches, ice damage, desiccation. (2) Begin scouting program for overwintering insects. (3) Apply pre-emergent herbicide when soil temperature reaches 10-12°C. (4) First nitrogen application as greens resume growth. (5) Core aerate greens and tees. (6) Begin dollar spot prevention program. (7) Monitor for ABW adult migration (200-300 GDD base 10°C). (8) Calibrate spray equipment.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Spring'],
 ARRAY['spring','checklist','startup','snow mould assessment','pre-emergent','aeration','GDD'],
 'Ontario IPM best practices'),

('cultural_practice', 'Early Summer Disease Prevention (June)',
 'June marks the transition from spring to peak disease season: (1) Dollar spot prevention/curative rotations begin. (2) First foliar chlorothalonil application window. (3) Monitor for brown patch as night temperatures exceed 20°C. (4) Reduce irrigation timing to minimize leaf wetness. (5) Begin dew removal protocols on greens. (6) Scout for chinch bug activity on south-facing slopes. (7) European chafer adults begin flying — reduce irrigation to deter egg-laying.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Summer'],
 ARRAY['june','early summer','dollar spot','brown patch','chinch bug','chafer','irrigation','dew'],
 'Ontario IPM seasonal calendar'),

('cultural_practice', 'Mid-Summer Stress Management (July-August)',
 'Peak stress period for Ontario turf: (1) Maintain dollar spot rotation — allocate second chlorothalonil foliar if needed. (2) Monitor for Pythium blight during hot humid periods (>25°C, saturated conditions). (3) Raise mowing heights during extreme heat. (4) Syringe greens at midday to cool turf. (5) Watch for anthracnose on stressed Poa annua. (6) Grub damage begins to appear in late August. (7) Avoid aggressive cultural practices during heat stress.',
 NULL, NULL,
 ARRAY['Bentgrass','Poa annua','Kentucky Bluegrass'],
 ARRAY['Summer'],
 ARRAY['july','august','heat stress','pythium','syringing','mowing height','anthracnose','grub'],
 'Ontario IPM seasonal calendar'),

('cultural_practice', 'Fall Preparation (September-October)',
 'Fall is the second most critical management period: (1) Overseed damaged areas — fall is the best establishment window. (2) Final dollar spot application. (3) Broadleaf herbicide cleanup if thresholds exceeded. (4) Core aerate fairways and tees. (5) Begin preparing snow mould fungicide program. (6) Monitor soil temperatures for degree-day models. (7) Last chance for grub assessment before winter. (8) Reduce nitrogen to avoid succulent growth heading into winter.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass'],
 ARRAY['Fall'],
 ARRAY['fall','september','october','overseeding','herbicide','aeration','snow mould prep'],
 'Ontario IPM seasonal calendar'),

('cultural_practice', 'Late Fall Snow Mould Window (November)',
 'The snow mould application window is the single most important turf management decision of the Ontario season. Target: apply before permanent snow cover, typically late October to mid-November depending on location and year. Key considerations: (1) Tank mix multi-site contact + systemic for broad-spectrum protection. (2) Check weather forecast — avoid applying before rain. (3) Ensure complete coverage of all playing surfaces. (4) This is the third and final chlorothalonil application allowed under PMRA restrictions.',
 NULL, NULL,
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 ARRAY['Fall'],
 ARRAY['november','snow mould','application window','critical timing','tank mix','permanent snow'],
 'Ontario IPM research; GTI Fact Sheets'),

('regulation', 'Glyphosate Use Restrictions on Golf Courses',
 'Glyphosate is permitted ONLY on playing surfaces: tees, fairways, greens, bunkers, and cart paths. It is NOT permitted for use on trees, shrubs, ornamentals, or patios on golf course properties. This restriction is specific to the Ontario cosmetic pesticide ban exemption. Superintendents must ensure all staff are aware of these boundaries. Spot treatment is the preferred application method.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer','Fall'],
 ARRAY['glyphosate','restriction','playing surface','cosmetic ban','spot treatment','boundary'],
 'Ontario Regulation 63/09'),

('product_tip', 'Sprayer Calibration — Season Start Protocol',
 'Calibrate all spray equipment before each season using the catch-test method: (1) Place collection containers at regular intervals across spray width. (2) Run sprayer at operating speed and pressure. (3) Measure collected volume and calculate uniformity coefficient. (4) Adjust nozzles, pressure, or speed as needed. (5) Re-test until variation is <10%. Document calibration on IPM forms. Poor calibration leads to over/under-application — both waste product and may violate PMRA label requirements.',
 NULL, NULL, NULL,
 ARRAY['Spring'],
 ARRAY['calibration','sprayer','catch test','nozzle','uniformity','IPM forms','spring startup'],
 'OMAFRA Pub 384; IPM accreditation requirements'),

('cultural_practice', 'Endophyte-Enhanced Cultivars for Insect Resistance',
 'Endophyte-enhanced perennial ryegrass and fine fescue cultivars contain beneficial fungi (Epichloë spp.) that produce alkaloids toxic to surface-feeding insects including chinch bugs, sod webworms, and billbugs. This provides natural, season-long insect resistance without pesticide applications. Specify endophyte-enhanced seed when ordering — endophyte viability decreases in storage, so use fresh seed. Not effective against root-feeding insects (white grubs). An essential component of IPM programs.',
 NULL, NULL,
 ARRAY['Perennial Ryegrass','Fine Fescue'],
 ARRAY['Spring','Fall'],
 ARRAY['endophyte','cultivar','insect resistance','chinch bug','sod webworm','alkaloid','seed'],
 'OMAFRA Pub 845'),

('product_tip', 'GDD-Based Application Timing',
 'Growing Degree Days (GDD) provide a more reliable timing guide than calendar dates for pest management decisions. Key Ontario thresholds (base 10°C): ABW adult migration at 200-300 GDD; crabgrass pre-emergent at forsythia bloom (approximately 100 GDD); European chafer flight at 800-1000 GDD. Track GDD from March 1 using daily formula: GDD = max(0, (high + low)/2 - base). Weather station data or Allturf weather integration provides automated tracking.',
 NULL, NULL, NULL,
 ARRAY['Spring','Summer'],
 ARRAY['GDD','growing degree days','timing','ABW','crabgrass','pre-emergent','threshold','degree day'],
 'OMAFRA Pub 845; Ontario IPM research');


-- ============================================================================
-- 5. SAMPLE GOLF COURSE PROFILES — 5 test courses
-- ============================================================================

-- First create the companies
INSERT INTO companies (id, name, industry, city, province) VALUES
('a0000000-0000-0000-0000-000000000001', 'Oakwood Golf & Country Club', 'Golf Course', 'Toronto', 'ON'),
('a0000000-0000-0000-0000-000000000002', 'Maple Creek Municipal Golf Course', 'Golf Course', 'London', 'ON'),
('a0000000-0000-0000-0000-000000000003', 'Pine Ridge Golf Club', 'Golf Course', 'Barrie', 'ON'),
('a0000000-0000-0000-0000-000000000004', 'Lakeshore Resort & Golf', 'Golf Course', 'Muskoka', 'ON'),
('a0000000-0000-0000-0000-000000000005', 'Centennial Sports Complex', 'Sports Turf', 'Hamilton', 'ON');

-- Then create golf course profiles
INSERT INTO golf_course_profiles (
  company_id, num_holes, total_acreage, course_type,
  grass_types, green_grass, fairway_grass, rough_grass,
  irrigation_type, water_source, soil_type,
  microclimate_zone, usda_zone,
  annual_turf_budget_min, annual_turf_budget_max,
  maintenance_level, ipm_program, notes
) VALUES

-- Private Championship
('a0000000-0000-0000-0000-000000000001', 18, 165.0, 'Private',
 ARRAY['Bentgrass','Poa annua','Kentucky Bluegrass','Perennial Ryegrass'],
 'Bentgrass', 'Kentucky Bluegrass / Perennial Ryegrass', 'Fine Fescue / Kentucky Bluegrass',
 'Full Automatic', 'Deep Well', 'Sandy Loam',
 'Lake Ontario microclimate — moderate temperatures, higher humidity', '6a',
 120000.00, 180000.00,
 'Championship', true,
 'Hosts provincial championship events. Full-time assistant superintendent. 30-member grounds crew. USGA-spec greens. Dollar spot is primary concern — 10+ fungicide applications per season. IPM accredited since 2012.'),

-- Public Municipal
('a0000000-0000-0000-0000-000000000002', 18, 140.0, 'Municipal',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 'Bentgrass', 'Kentucky Bluegrass', 'Tall Fescue / Fine Fescue',
 'Semi-Automatic', 'Municipal Water', 'Clay Loam',
 'Southwestern Ontario — warm summers, moderate snow cover', '6b',
 45000.00, 65000.00,
 'Standard', true,
 'City-operated 18-hole course. Budget-conscious management. 8-member crew. Focuses on playability over tournament conditions. IPM accredited. Minimal insecticide use. Fairway fungicide limited to dollar spot prevention only.'),

-- Semi-Private
('a0000000-0000-0000-0000-000000000003', 27, 210.0, 'Semi-Private',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Poa annua'],
 'Bentgrass / Poa annua mix', 'Kentucky Bluegrass / Perennial Ryegrass', 'Kentucky Bluegrass',
 'Full Automatic', 'Pond / Irrigation Pond', 'Loam',
 'Central Ontario — shorter season, heavier snow cover', '5b',
 80000.00, 110000.00,
 'High', true,
 '27-hole facility with 3 distinct nines. Significant Poa annua on greens — ABW is a major concern. Snow mould management critical with 100+ days snow cover. 15-member crew. Active renovation program converting greens to bentgrass.'),

-- Resort
('a0000000-0000-0000-0000-000000000004', 36, 320.0, 'Resort',
 ARRAY['Bentgrass','Kentucky Bluegrass','Perennial Ryegrass','Fine Fescue'],
 'Bentgrass', 'Kentucky Bluegrass / Perennial Ryegrass', 'Fine Fescue / Mixed Stand',
 'Full Automatic', 'Lake', 'Modified Sand',
 'Muskoka — shorter season, heavy snow, lake effect microclimate', '5a',
 150000.00, 220000.00,
 'Championship', true,
 'Two championship 18-hole courses. Resort setting with high guest expectations. Extended snow cover (120+ days). Heavy snow mould program. Lake effect creates unique disease pressure. 35-member seasonal crew. Gray snow mould is primary winter concern. Dollar spot and Pythium during compressed summer season.'),

-- Sports Turf
('a0000000-0000-0000-0000-000000000005', NULL, 25.0, 'Municipal',
 ARRAY['Kentucky Bluegrass','Perennial Ryegrass'],
 NULL, NULL, NULL,
 'Semi-Automatic', 'Municipal Water', 'Sand-based',
 'Southern Ontario — warm summers, moderate winters', '6b',
 30000.00, 50000.00,
 'Standard', true,
 'Multi-sport complex with 4 soccer fields, 2 baseball diamonds, 1 football field. Sand-based fields with drain tile. Heavy traffic during tournament season. Main concerns: compaction, white grubs, and crabgrass. Endophyte-enhanced perennial ryegrass used for insect resistance.');

-- Create sample contacts for each course
INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, role, status) VALUES
('David', 'Morrison', 'dmorrison@oakwoodgcc.ca', '416-555-0101', 'Head Superintendent', 'a0000000-0000-0000-0000-000000000001', 'Superintendent', 'Active Customer'),
('Sarah', 'Chen', 'schen@london.ca', '519-555-0202', 'Parks Supervisor', 'a0000000-0000-0000-0000-000000000002', 'Superintendent', 'Active Customer'),
('Mike', 'Patterson', 'mpatterson@pineridgegc.ca', '705-555-0303', 'Superintendent', 'a0000000-0000-0000-0000-000000000003', 'Superintendent', 'Active Customer'),
('James', 'Blackwood', 'jblackwood@lakeshoreresort.ca', '705-555-0404', 'Director of Agronomy', 'a0000000-0000-0000-0000-000000000004', 'Director of Agronomy', 'Active Customer'),
('Lisa', 'Romano', 'lromano@hamilton.ca', '905-555-0505', 'Turf Manager', 'a0000000-0000-0000-0000-000000000005', 'Superintendent', 'Prospect');

-- ============================================================================
-- Backfill compatible_tank_mixes with resolved UUIDs
-- Must run after all offerings are inserted
-- ============================================================================

-- Helper: resolve product names to UUID arrays
UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Bravo','Heritage','Primo MAXX','Medallion'])
) WHERE name = 'Banner MAXX';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Banner MAXX','Bravo','Primo MAXX'])
) WHERE name = 'Heritage';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Banner MAXX','Heritage','Bravo'])
) WHERE name = 'Primo MAXX';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Primo MAXX'])
) WHERE name = 'Instrata';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Banner MAXX','Heritage','Medallion'])
) WHERE name = 'Bravo';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Bravo','Heritage'])
) WHERE name = 'Eagle';

UPDATE offerings SET compatible_tank_mixes = (
  SELECT array_agg(o2.id) FROM offerings o2
  WHERE o2.name = ANY(ARRAY['Banner MAXX','Heritage','Bravo'])
) WHERE name = 'Medallion';
