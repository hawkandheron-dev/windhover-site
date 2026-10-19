-- Link Status for Works and Sources (2026-10-19).
--
-- Matthew: where a work or source has no link, or only an author page, and
-- nothing better can be found, mark it Unverified and hide it from the app
-- until its link is checked. An Unverified entry that has a link is hidden
-- from readers; an entry with no link always shows (nothing to verify).
--
-- New rows start Unverified, so a work added in the admin tools stays hidden
-- until someone confirms its link. The backfill below runs only when the
-- column is first created, so re-running this file never overwrites a status
-- chosen in the admin tools since.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'CH_Works' and column_name = 'link_status'
  ) then
    alter table public."CH_Works"
      add column link_status text not null default 'Unverified'
      check (link_status in ('Verified', 'Unverified'));
    update public."CH_Works" set link_status = 'Verified'
      where work_id not in (
    31, 39, 46, 53, 60, 61, 64, 65, 66, 67, 70, 72, 79, 85, 86, 99, 100, 101, 102, 103, 104,
    105, 106, 107, 113, 114, 115, 116, 117, 120, 128, 129, 131, 132, 133, 134, 135, 136, 137,
    138, 139, 144, 145, 146, 150, 151, 152, 153, 154, 159, 160, 161, 164, 165, 168, 169, 174,
    175, 176, 180, 181, 182, 183, 187, 188, 191, 192, 194, 196, 198, 200, 202, 203, 205, 208,
    209, 210, 211, 212, 213, 214, 215, 220, 221, 222, 223, 224, 225, 232, 233, 234, 235, 236,
    237, 238, 242, 243, 244, 245, 246, 247, 249, 250, 252, 253, 254, 255, 258, 260, 262, 263,
    264, 267, 268, 269, 272, 273, 274, 288, 289, 292, 293, 294, 298, 299, 303, 304, 310, 315,
    322, 323, 324, 325, 331, 335, 345, 349, 350
      );
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'CH_Sources' and column_name = 'link_status'
  ) then
    alter table public."CH_Sources"
      add column link_status text not null default 'Unverified'
      check (link_status in ('Verified', 'Unverified'));
    update public."CH_Sources" set link_status = 'Verified'
      where source_id not in ('src-alcuin-britannica', 'src-britannica-gregory-thaumaturgus', 'src-jerome-britannica', 'src-melanchthon-britannica', 'src-poor-clares-britannica', 'src-rabanus-britannica');
  end if;
end
$$;

-- Matthew's decisions on the first list (doc "Works & Sources: links still to settle").
-- Links he asked to delete: the work stays, as plain text (nothing to verify).
update public."CH_Works" set text_url = null where work_id = 171 and text_url = 'https://hrcak.srce.hr/265410'; -- Cyril and Methodius: Old Church Slavonic Translation of the Gospels (traditional attribution)
update public."CH_Works" set text_url = null where work_id = 172 and text_url = 'https://hrcak.srce.hr/22379'; -- Cyril and Methodius: Old Church Slavonic Liturgical Translations (selected, traditional attribution)
update public."CH_Works" set text_url = null where work_id = 287 and text_url = 'https://books.google.com/books/about/The_Letters_and_Instructions_of_Peter_Faber.html?id=8b7sAAAAMAAJ'; -- Peter Faber: Memoriale (Spiritual Diary)
update public."CH_Works" set text_url = null where work_id = 204 and text_url = 'https://www.ofm.org/franciscan-writings/testament'; -- Francis of Assisi: Testament
update public."CH_Works" set text_url = null where work_id = 189 and text_url = 'https://www.glossae.net/en/home/'; -- Anselm of Laon: Glossa Ordinaria on the Bible (traditionally associated)
update public."CH_Works" set text_url = null where work_id = 97 and text_url = 'https://www.persee.fr/doc/rscir_0035-2217_1993_num_67_2_3230_t1_0122_0000_2'; -- Didymus the Blind: On the Holy Spirit (De Spiritu Sancto)
-- A work he asked to remove (its text is covered by his Letters entry).
delete from public."CH_Works" where work_id = 123 and text_url = 'https://www.earlymedievalmonasticism.org/texts/Caesarius-Regula-ad-virgines.html'; -- Caesarius of Arles: Rule for Nuns
