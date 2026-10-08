-- Lifelines tour copy, the owner's edits (M6, 2026-10-08).
--
-- Matthew edited the 20 scenes in the "Lifelines tour copy" doc. This applies
-- the fields he changed, word for word (stray double spaces tidied), plus the
-- changes he asked for in the doc's comments:
--
--   * scene 1 shows the Crucifixion and Resurrection as well as Jesus;
--   * scene 3 is titled "John";
--   * scene 13 is "The Cappadocians"; scene 20 is "A light in the dark";
--   * scene 7's map starts in Smyrna and travels to Lyons (map_from), as the
--     second paragraph moves Irenaeus from home to Gaul.
--
-- Idempotent: every statement sets a value outright.

alter table "CH_TourScenes"
  add column if not exists map_from text;

comment on column "CH_TourScenes".map_from is
  'Where the opened figure''s map starts before it travels to their own location (Lifelines).';

update "CH_TourScenes" set
  narrative = $t$To explore the history of the Christian church, we'll start with the life, death and resurrection of Jesus.$t$,
  point_ids = array['event-crucifixion']
where scene_id = 'jesus-intro';

update "CH_TourScenes" set
  narrative = $t$Jesus is born in Roman-occupied Palestine under the reign of Caesar Augustus, who ruled the Roman Empire from 27 BC to AD 14. He was crucified outside Jerusalem around 27 AD.

Jesus's disciples wrote that they saw him rise from the dead, and that forty days later, he ascended into the sky. They passed this testimony down to other followers of Jesus, who then did the same in their time.$t$
where scene_id = 'jesus';

update "CH_TourScenes" set
  title = 'John',
  narrative = $t$One of those disciples is John, the son of Zebedee.$t$
where scene_id = 'john';

update "CH_TourScenes" set
  narrative = $t$Polycarp speaks of talking with John and "the rest of those who had seen the Lord," according to Irenaeus, writing a generation later. Polycarp becomes the bishop of the church in Smyrna.$t$
where scene_id = 'polycarp';

update "CH_TourScenes" set
  narrative = $t$As a boy growing up in Smyrna (in what is now Izmir, Turkey), Irenaeus sits under Polycarp's teachings about the words of Jesus and his miracles. He writes: "Polycarp having thus received [them] from the eye-witnesses of the Word of life, would recount them all in harmony with the Scriptures."$t$
where scene_id in ('irenaeus', 'irenaeus-2', 'irenaeus-3');

update "CH_TourScenes" set
  additional_narrative = $t$Irenaeus later becomes a bishop in Gaul, far from his home in Smyrna.$t$
where scene_id in ('irenaeus-2', 'irenaeus-3');

update "CH_TourScenes" set map_from = 'Smyrna' where scene_id = 'irenaeus-2';

update "CH_TourScenes" set
  third_narrative = $t$Hippolytus is another early bishop in Rome. He is later called a disciple of Irenaeus by Photius (c. 810-895), and is influenced by Irenaeus' teachings.$t$
where scene_id = 'irenaeus-3';

update "CH_TourScenes" set
  narrative = $t$Hippolytus' works don't survive, but he is quoted later by the historian Eusebius and is considered one of the more influential early church leaders.$t$
where scene_id = 'hippolytus';

update "CH_TourScenes" set
  narrative = $t$Gregory Thaumaturgus is a student of Origen, and becomes an influential teacher and church leader in Pontus, near the Black Sea.$t$
where scene_id = 'gregory-thaumaturgus';

update "CH_TourScenes" set
  narrative = $t$As a young girl in Neocaesarea, Pontus, Macrina the Elder listened to the teaching of Gregory Thaumaturgus, according to the testimony of her famous grandchildren.$t$
where scene_id = 'macrina-elder';

update "CH_TourScenes" set
  title = 'The Cappadocians',
  narrative = $t$The brothers Basil the Great and Gregory of Nyssa, along with their friend Gregory of Nazianzus, are known then and now for exploring the mystery of the Trinity. The sister of Basil and Gregory, Macrina the Younger, is called "Teacher" by Gregory in his work "On the Soul and the Resurrection". These three are the grandchildren of Macrina the Elder.$t$
where scene_id = 'cappadocians';

update "CH_TourScenes" set
  narrative = $t$Basil the Great wrote to Ambrose, a bishop in Milan.$t$
where scene_id = 'ambrose';

update "CH_TourScenes" set
  narrative = $t$Prosper of Aquitaine writes back and forth with Augustine, and brings Augustine's ideas to the church in Europe.$t$
where scene_id = 'prosper';

update "CH_TourScenes" set
  narrative = $t$Meanwhile, back in North Africa, a young priest named Julianus Pomerius flees the marauding Vandals and saves Augustine’s works by taking them to Gaul. He starts a school in Arles.$t$
where scene_id = 'pomerius';

update "CH_TourScenes" set
  narrative = $t$By the year 530, Caesarius is an old man. In the West, Rome is in decline. Byzantium rises in the East.$t$
where scene_id = 'year-530';

update "CH_TourScenes" set
  title = 'A light in the dark',
  narrative = $t$Five hundred years after the life of Jesus, monks and missionaries spread out across continents, bearing witness to what was passed down to them.$t$
where scene_id = 'build-out';
