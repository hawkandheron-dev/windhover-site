-- Fixes from Matthew's read-through of Polycarp, Tertullian and Irenaeus
-- (2026-10-21). Each statement is guarded by what it replaces, so it never
-- overwrites an edit made in the admin tools since.

-- "Ignatius - Epistle to Polycarp" linked to the Epistle to the Smyrnaeans
-- (fathers/0109); the Epistle to Polycarp is fathers/0110.
update public."CH_Sources" set url = 'https://www.newadvent.org/fathers/0110.htm'
  where source_id = 'src-ignatius-to-polycarp' and url = 'https://www.newadvent.org/fathers/0109.htm';

-- Tertullian, Prescription ch. 32: the link is bad. Hide the source (Unverified)
-- until it has a good one; the work "Prescription Against Heretics" is untouched.
update public."CH_Sources" set link_status = 'Unverified'
  where source_id = 'src-tertullian-prescription-32'
    and url = 'https://www.ccel.org/ccel/schaff/anf03.v.iii.ii.xxxii.html';

-- Irenaeus: "Demonstration of the Apostolic Preaching" is not in the page it
-- linked to (the ANF vol. 1 index); remove the work.
delete from public."CH_Works" where work_id = 31 and person_id = 'irenaeus'
  and name like 'Demonstration of the Apostolic Preaching%';

-- Irenaeus: Against Heresies showed twice, as a work and as a source pointing
-- at the same page. Keep the work; take the source off Irenaeus only (it still
-- supports Valentinus, Basilides and Cerinthus).
delete from public."CH_Source_Figures" where source_id = 'src-irenaeus-ah-1' and person_id = 'irenaeus';
