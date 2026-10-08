-- Lifelines tour follow-ups (owner: "yes to all", 2026-10-08).
--
--   * Scene 2 dates the crucifixion "around AD 30–33" (it said 27 AD), which
--     matches the scholarly range and the timeline's own Crucifixion entry.
--   * The links Matthew put in the copy doc come back: [words](url) in a
--     scene's text is drawn as a link by Lifelines (TourPanel textLinks).
--   * John the Evangelist's figure reads "John", as his tour scene does.
--
-- Idempotent: every statement sets a value outright.

update "CH_TourScenes" set
  narrative = $t$Jesus is born in Roman-occupied Palestine under the reign of Caesar Augustus, who ruled the Roman Empire from 27 BC to AD 14. He was crucified outside Jerusalem around AD 30–33.

Jesus's disciples wrote that they saw him rise from the dead, and that forty days later, he ascended into the sky. They passed this testimony down to other followers of Jesus, who then did the same in their time.$t$
where scene_id = 'jesus';

update "CH_TourScenes" set
  narrative = $t$Polycarp speaks of talking with John and "the rest of those who had seen the Lord," according to [Irenaeus](https://www.newadvent.org/fathers/0134.htm), writing a generation later. Polycarp becomes the bishop of the church in Smyrna.$t$
where scene_id = 'polycarp';

update "CH_TourScenes" set
  narrative = $t$As a boy growing up in Smyrna (in what is now Izmir, Turkey), Irenaeus sits under Polycarp's teachings about the words of Jesus and his miracles. He [writes](https://www.newadvent.org/fathers/0134.htm): "Polycarp having thus received [them] from the eye-witnesses of the Word of life, would recount them all in harmony with the Scriptures."$t$
where scene_id in ('irenaeus', 'irenaeus-2', 'irenaeus-3');

update "CH_People" set name = 'John' where person_id = 'john-evangelist';
