\pset footer off
SELECT t.work_id,
       lower(trim(t.lang)),
       COALESCE(t.voice,''),
       replace(replace(w.title, E'\t',' '), E'\n',' '),
       COALESCE(NULLIF(t.subtitle_url,''), NULLIF(w.subtitle_take1_json_url,''), '-'),
       COALESCE(NULLIF(t.audio_url,''), '-'),
       replace(replace(COALESCE(NULLIF(t.lyrics,''), w.lyrics_preview, ''), E'\t',' '), E'\n','<<NL>>')
  FROM work_language_tracks t
  JOIN user_works w ON w.id = t.work_id
 WHERE lower(trim(t.lang)) ~ '^[a-z]{2,3}(-[a-z0-9]+)*$'
   AND lower(trim(t.lang)) NOT IN ('zh','en','ja','ko','es','fr','de','it','pt','ru','fa','el','he','hi','th','ar','tr',
                                   'orig','auto','und','unknown','default','pre-epic','orig-pre-epic')
   AND t.audio_url IS NOT NULL AND t.audio_url <> ''
 ORDER BY w.title, lower(trim(t.lang)), COALESCE(t.voice,'');
