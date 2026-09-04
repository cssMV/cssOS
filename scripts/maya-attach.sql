\set ON_ERROR_STOP on
BEGIN;
UPDATE user_works SET lyrics_preview='《Xkik''》血月姑娘
[Intro]
[Verse 1]
Are'' u xe'' ojer tzij
pa Xib''alb''a k''o jun che''
maja b''i uwach, xa b''aq
xinb''e chuxe'', xinwil ri jolomaj
Q''equm chikaj, saq pa nuk''u''x
[Verse 2]
Xub''ij ri jolomaj chwe
"Yakan aq''ab'', ali, chaya'' ak''ab''"
Xinya'' nuq''ab'' pa saqil
xtzaj jun ja'' pa nuq''ab''
Q''equm chikaj, saq pa nuk''u''x
[Chorus 1]
In Xkik'', in umi''al ajaw kamik
in k''o pa upam ri q''equm
xa k''o k''aslemal pa nupam
kinb''ison ta, kinb''ixon
Q''equm chikaj, saq pa nuk''u''x
[Verse 3]
Xrilo ri nuqajaw, xyakataj royowal
"Chikamisaj ri ali, chikam uk''u''x"
Xeb''e ri ajkamisanel wuk''
xinb''ij chike: "Chiwila'' ri kikel che''"
Q''equm chikaj, saq pa nuk''u''x
[Verse 4]
Ri che'' xuya'' ukikel pa jun tz''alam
kaq, kaq jacha'' nukikel
Xkik''ow ri ajkamisanel
xkik''am ri kikel che'', man in taj
Q''equm chikaj, saq pa nuk''u''x
[Chorus 2]
In Xkik'', in xinel pa Xib''alb''a
xinaq''an chikaj, xinwil ri q''ij
nab''e mul xinwil ri saq
kinoq'' ta, kinb''ixon
Q''equm chikaj, saq pa nuk''u''x
[Bridge]
Ri ik'' kaq chikaj
jacha'' jun kikel pa ja''
Xinya'' nuq''ab'' chirij nupam
xkib''ij chwe: "Oj k''o, nan"
Keb'' ke''ok, keb'' ke''el
[Chorus 3]
In Xkik'', in unan ri e''ka''ib''
Junajpu, Xb''alamke
xinkiya'' pa ulew, pa saq
xinkiya'' chirij ri kamik
Q''equm chikaj, saq pa nuk''u''x
[Chorus 4]
Man kinkam taj, kinwinaqir
jacha'' ri ixim pa ulew
katzalij ri q''ij, katzalij ri ik''
katzalij ri k''aslemal
Q''equm chikaj, saq pa nuk''u''x
[Outro]
Are'' u xe'' ojer tzij
Are'' u xe'' ojer tzij
in Xkik'', in k''aslemal
ri q''equm xok saq
Are'' u xe'' ojer tzij', preview_audio_url='https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p1-take1-2931a62d6ad9f9a0.mp3', updated_at=now() WHERE id='c5ab48df-1157-4b0b-b516-6c0db2dde0be';
DELETE FROM work_language_tracks WHERE work_id='c5ab48df-1157-4b0b-b516-6c0db2dde0be';
INSERT INTO work_language_tracks (work_id, lang, track_order, audio_url, lyrics, status, is_default, created_at) VALUES ('c5ab48df-1157-4b0b-b516-6c0db2dde0be','quc',0,'https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p1-take1-2931a62d6ad9f9a0.mp3','《Xkik''》血月姑娘
[Intro]
[Verse 1]
Are'' u xe'' ojer tzij
pa Xib''alb''a k''o jun che''
maja b''i uwach, xa b''aq
xinb''e chuxe'', xinwil ri jolomaj
Q''equm chikaj, saq pa nuk''u''x
[Verse 2]
Xub''ij ri jolomaj chwe
"Yakan aq''ab'', ali, chaya'' ak''ab''"
Xinya'' nuq''ab'' pa saqil
xtzaj jun ja'' pa nuq''ab''
Q''equm chikaj, saq pa nuk''u''x
[Chorus 1]
In Xkik'', in umi''al ajaw kamik
in k''o pa upam ri q''equm
xa k''o k''aslemal pa nupam
kinb''ison ta, kinb''ixon
Q''equm chikaj, saq pa nuk''u''x
[Verse 3]
Xrilo ri nuqajaw, xyakataj royowal
"Chikamisaj ri ali, chikam uk''u''x"
Xeb''e ri ajkamisanel wuk''
xinb''ij chike: "Chiwila'' ri kikel che''"
Q''equm chikaj, saq pa nuk''u''x
[Verse 4]
Ri che'' xuya'' ukikel pa jun tz''alam
kaq, kaq jacha'' nukikel
Xkik''ow ri ajkamisanel
xkik''am ri kikel che'', man in taj
Q''equm chikaj, saq pa nuk''u''x
[Chorus 2]
In Xkik'', in xinel pa Xib''alb''a
xinaq''an chikaj, xinwil ri q''ij
nab''e mul xinwil ri saq
kinoq'' ta, kinb''ixon
Q''equm chikaj, saq pa nuk''u''x
[Bridge]
Ri ik'' kaq chikaj
jacha'' jun kikel pa ja''
Xinya'' nuq''ab'' chirij nupam
xkib''ij chwe: "Oj k''o, nan"
Keb'' ke''ok, keb'' ke''el
[Chorus 3]
In Xkik'', in unan ri e''ka''ib''
Junajpu, Xb''alamke
xinkiya'' pa ulew, pa saq
xinkiya'' chirij ri kamik
Q''equm chikaj, saq pa nuk''u''x
[Chorus 4]
Man kinkam taj, kinwinaqir
jacha'' ri ixim pa ulew
katzalij ri q''ij, katzalij ri ik''
katzalij ri k''aslemal
Q''equm chikaj, saq pa nuk''u''x
[Outro]
Are'' u xe'' ojer tzij
Are'' u xe'' ojer tzij
in Xkik'', in k''aslemal
ri q''equm xok saq
Are'' u xe'' ojer tzij','ready',true,now());
DELETE FROM work_assets WHERE work_id='c5ab48df-1157-4b0b-b516-6c0db2dde0be' AND asset_type='audio_track_1';
INSERT INTO work_assets (work_id, asset_type, url, meta) VALUES ('c5ab48df-1157-4b0b-b516-6c0db2dde0be','audio_track_1','https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p1-take1-2931a62d6ad9f9a0.mp3','{"source":"maya-w2072"}'::jsonb);
UPDATE user_works SET lyrics_preview='《Xib''alb''a》下黄泉
[Intro]
[Verse 1]
Junajpu, Xb''alamke
kaqasaj qib'' pa ri b''e q''equm
job'' ja'' kaqak''ow, job'' b''e
kaqetamaj ri kib''i'' konojel
Kamik keb''ixon, oj kojetz''an
[Verse 2]
Nab''e ja: ri q''equm ja
ukab'' ja: ri kaq ja
urox ja: ri b''alam ja
ukaj ja: ri sotz'' ja, kaxib''in
Kamik keb''ixon, oj kojetz''an
[Chorus 1]
Kojetz''an, kojetz''an pa ri jom
ri kikotz''i''j are'' ri ka''
ri kib''ix are'' ri kamik
xa oj k''a kojetz''an na
Kamik keb''ixon, oj kojetz''an
[Verse 3]
"Chiya'' ri kotz''i''j chaqe" xech''aw
"We man, kixkam chwa''q"
Xeb''e ri sanik pa aq''ab''
xkik''am ri kotz''i''j pa ri kachoch
Kamik keb''ixon, oj kojetz''an
[Verse 4]
Xkib''ij ri ajawab'' pa Xib''alb''a
"¿Jachin xub''an wa''? ¿Jachin?"
Kojse''n, kojse''n, man kojb''ison taj
ri kixib''inel man kojuxib''ij taj
Kamik keb''ixon, oj kojetz''an
[Chorus 2]
Kojetz''an, kojetz''an pa ri jom
ri ka'' kach''aw pa ri ulew
ri jom kach''aw pa ri kaj
ri kamik kach''aw, man kojtakej taj
Kamik keb''ixon, oj kojetz''an
[Bridge]
Xub''ij ri Junajpu chwe
"We kinkam, chaya'' nub''aq pa ja''"
Xinya'' ri ub''aq pa ri nima ja''
xk''astaj jun kar, xk''astaj jun winaq
Kamik kub''ij "jun", k''aslemal kub''ij "keb''"
[Chorus 3]
Kojetz''an, kojetz''an pa ri jom
xujkam, xujk''astaj chik
xujkam, xujk''astaj chik
kamik man ta ri k''isb''al
Kamik keb''ixon, oj kojetz''an
[Chorus 4]
Ri ajawab'' xkib''ij: "Chib''ana'' chaqe"
Xqab''an, man xek''astaj ta chik
xkam ri kamik pa ri jom
xkam ri q''equm pa ri saq
Kamik keb''ixon, oj kojetz''an
[Outro]
Junajpu, Xb''alamke
Junajpu, Xb''alamke
xujkam, xujk''astaj chik
xkam ri kamik pa ri jom
Junajpu, Xb''alamke', preview_audio_url='https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p2-take1-73b86cb4a48f8099.mp3', updated_at=now() WHERE id='767cca0e-9c13-4407-98c3-f17b6297b99e';
DELETE FROM work_language_tracks WHERE work_id='767cca0e-9c13-4407-98c3-f17b6297b99e';
INSERT INTO work_language_tracks (work_id, lang, track_order, audio_url, lyrics, status, is_default, created_at) VALUES ('767cca0e-9c13-4407-98c3-f17b6297b99e','quc',0,'https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p2-take1-73b86cb4a48f8099.mp3','《Xib''alb''a》下黄泉
[Intro]
[Verse 1]
Junajpu, Xb''alamke
kaqasaj qib'' pa ri b''e q''equm
job'' ja'' kaqak''ow, job'' b''e
kaqetamaj ri kib''i'' konojel
Kamik keb''ixon, oj kojetz''an
[Verse 2]
Nab''e ja: ri q''equm ja
ukab'' ja: ri kaq ja
urox ja: ri b''alam ja
ukaj ja: ri sotz'' ja, kaxib''in
Kamik keb''ixon, oj kojetz''an
[Chorus 1]
Kojetz''an, kojetz''an pa ri jom
ri kikotz''i''j are'' ri ka''
ri kib''ix are'' ri kamik
xa oj k''a kojetz''an na
Kamik keb''ixon, oj kojetz''an
[Verse 3]
"Chiya'' ri kotz''i''j chaqe" xech''aw
"We man, kixkam chwa''q"
Xeb''e ri sanik pa aq''ab''
xkik''am ri kotz''i''j pa ri kachoch
Kamik keb''ixon, oj kojetz''an
[Verse 4]
Xkib''ij ri ajawab'' pa Xib''alb''a
"¿Jachin xub''an wa''? ¿Jachin?"
Kojse''n, kojse''n, man kojb''ison taj
ri kixib''inel man kojuxib''ij taj
Kamik keb''ixon, oj kojetz''an
[Chorus 2]
Kojetz''an, kojetz''an pa ri jom
ri ka'' kach''aw pa ri ulew
ri jom kach''aw pa ri kaj
ri kamik kach''aw, man kojtakej taj
Kamik keb''ixon, oj kojetz''an
[Bridge]
Xub''ij ri Junajpu chwe
"We kinkam, chaya'' nub''aq pa ja''"
Xinya'' ri ub''aq pa ri nima ja''
xk''astaj jun kar, xk''astaj jun winaq
Kamik kub''ij "jun", k''aslemal kub''ij "keb''"
[Chorus 3]
Kojetz''an, kojetz''an pa ri jom
xujkam, xujk''astaj chik
xujkam, xujk''astaj chik
kamik man ta ri k''isb''al
Kamik keb''ixon, oj kojetz''an
[Chorus 4]
Ri ajawab'' xkib''ij: "Chib''ana'' chaqe"
Xqab''an, man xek''astaj ta chik
xkam ri kamik pa ri jom
xkam ri q''equm pa ri saq
Kamik keb''ixon, oj kojetz''an
[Outro]
Junajpu, Xb''alamke
Junajpu, Xb''alamke
xujkam, xujk''astaj chik
xkam ri kamik pa ri jom
Junajpu, Xb''alamke','ready',true,now());
DELETE FROM work_assets WHERE work_id='767cca0e-9c13-4407-98c3-f17b6297b99e' AND asset_type='audio_track_1';
INSERT INTO work_assets (work_id, asset_type, url, meta) VALUES ('767cca0e-9c13-4407-98c3-f17b6297b99e','audio_track_1','https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p2-take1-73b86cb4a48f8099.mp3','{"source":"maya-w2072"}'::jsonb);
UPDATE user_works SET lyrics_preview='《Ixim》玉米重生
[Intro]
[Verse 1]
Xaqan ri qajaw pa ri kok
xujel pa ri ulew jacha'' jun ijaj
saq ri uwi'', q''an ri uwach
kach''aw ri ixim pa ri jab''
Ixim kakam, ixim kak''astaj
[Verse 2]
Nab''e xkib''an winaq ruk'' ulew
xtukin, xb''e pa ja''
ukab'' xkib''an ruk'' che''
maja unimal, maja uk''u''x
Ixim kakam, ixim kak''astaj
[Chorus 1]
Xkib''an winaq ruk'' ixim
saq ixim, q''an ixim
kikel ri ja'' re ixim
qak''u''x are'' ri ixim
Ixim kakam, ixim kak''astaj
[Verse 3]
Kaj winaq nab''e xewinaqir
xkil ronojel ri uwach ulew
xkil ri kaj, xkil ri ja''
"Sib''alaj nim ri qawach" xecha''
Ixim kakam, ixim kak''astaj
[Verse 4]
Xkib''ij ri tz''aqol: "Sib''alaj nim"
xkijil ri kiwach ruk'' juyub''
kamik xok pa ri kiwach
rumal ri'' oj kakam na
Ixim kakam, ixim kak''astaj
[Chorus 2]
Xkib''an winaq ruk'' ixim
kaqatik ri ijaj pa ulew
kaqamuq ri kaminaq pa ulew
junam ri b''e ke''
Ixim kakam, ixim kak''astaj
[Bridge]
Ri q''ij xaqan pa ri juyub''
xoq''ik ri sotz'', xtane'' ri aq''ab''
Junajpu xok q''ij, Xb''alamke xok ik''
ri Xkik'' xok ch''umil
Ronojel ri kamik xok saq
[Chorus 3]
Xkib''an winaq ruk'' ixim
ri qatinamit man kakam taj
ri qatzij man kakam taj
kaqab''ij chi ri ojer tzij
Ixim kakam, ixim kak''astaj
[Chorus 4]
Kaqatik, kaqak''ol, kaqatij
kaqaya'' chike ri ke''petik
jun ijaj, jun tinamit
jun ixim, jun k''aslemal
Ixim kakam, ixim kak''astaj
[Outro]
Xkib''an winaq ruk'' ixim
Xkib''an winaq ruk'' ixim
jun ijaj, jun k''aslemal
kaqab''ij chi ri ojer tzij
Are'' u xe'' ojer tzij
## 中文对照(供审阅, **不进 Suno**)
### 第一部 ·《血月》
### 第二部 ·《黄泉》
### 第三部 ·《玉米》', preview_audio_url='https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p3-take1-5c3a3ba75088713d.mp3', updated_at=now() WHERE id='9a1e578a-a2e7-4149-afd1-d614349f1b40';
DELETE FROM work_language_tracks WHERE work_id='9a1e578a-a2e7-4149-afd1-d614349f1b40';
INSERT INTO work_language_tracks (work_id, lang, track_order, audio_url, lyrics, status, is_default, created_at) VALUES ('9a1e578a-a2e7-4149-afd1-d614349f1b40','quc',0,'https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p3-take1-5c3a3ba75088713d.mp3','《Ixim》玉米重生
[Intro]
[Verse 1]
Xaqan ri qajaw pa ri kok
xujel pa ri ulew jacha'' jun ijaj
saq ri uwi'', q''an ri uwach
kach''aw ri ixim pa ri jab''
Ixim kakam, ixim kak''astaj
[Verse 2]
Nab''e xkib''an winaq ruk'' ulew
xtukin, xb''e pa ja''
ukab'' xkib''an ruk'' che''
maja unimal, maja uk''u''x
Ixim kakam, ixim kak''astaj
[Chorus 1]
Xkib''an winaq ruk'' ixim
saq ixim, q''an ixim
kikel ri ja'' re ixim
qak''u''x are'' ri ixim
Ixim kakam, ixim kak''astaj
[Verse 3]
Kaj winaq nab''e xewinaqir
xkil ronojel ri uwach ulew
xkil ri kaj, xkil ri ja''
"Sib''alaj nim ri qawach" xecha''
Ixim kakam, ixim kak''astaj
[Verse 4]
Xkib''ij ri tz''aqol: "Sib''alaj nim"
xkijil ri kiwach ruk'' juyub''
kamik xok pa ri kiwach
rumal ri'' oj kakam na
Ixim kakam, ixim kak''astaj
[Chorus 2]
Xkib''an winaq ruk'' ixim
kaqatik ri ijaj pa ulew
kaqamuq ri kaminaq pa ulew
junam ri b''e ke''
Ixim kakam, ixim kak''astaj
[Bridge]
Ri q''ij xaqan pa ri juyub''
xoq''ik ri sotz'', xtane'' ri aq''ab''
Junajpu xok q''ij, Xb''alamke xok ik''
ri Xkik'' xok ch''umil
Ronojel ri kamik xok saq
[Chorus 3]
Xkib''an winaq ruk'' ixim
ri qatinamit man kakam taj
ri qatzij man kakam taj
kaqab''ij chi ri ojer tzij
Ixim kakam, ixim kak''astaj
[Chorus 4]
Kaqatik, kaqak''ol, kaqatij
kaqaya'' chike ri ke''petik
jun ijaj, jun tinamit
jun ixim, jun k''aslemal
Ixim kakam, ixim kak''astaj
[Outro]
Xkib''an winaq ruk'' ixim
Xkib''an winaq ruk'' ixim
jun ijaj, jun k''aslemal
kaqab''ij chi ri ojer tzij
Are'' u xe'' ojer tzij
## 中文对照(供审阅, **不进 Suno**)
### 第一部 ·《血月》
### 第二部 ·《黄泉》
### 第三部 ·《玉米》','ready',true,now());
DELETE FROM work_assets WHERE work_id='9a1e578a-a2e7-4149-afd1-d614349f1b40' AND asset_type='audio_track_1';
INSERT INTO work_assets (work_id, asset_type, url, meta) VALUES ('9a1e578a-a2e7-4149-afd1-d614349f1b40','audio_track_1','https://cdn.cssstudio.app/artifacts/mv-songs/maya/maya-p3-take1-5c3a3ba75088713d.mp3','{"source":"maya-w2072"}'::jsonb);
COMMIT;
SELECT left(w.title,34) AS 标题, length(w.lyrics_preview) AS 词长, (w.preview_audio_url IS NOT NULL) AS 有音频, (SELECT count(*) FROM work_language_tracks t WHERE t.work_id=w.id) AS 语言轨 FROM user_works w WHERE w.title LIKE 'Popol Wuj%' ORDER BY w.sequence_index;
