SELECT * FROM (
  SELECT json_object_agg(id::text, json_build_object(
    'title', title, 'language', coalesce(language,''), 'civilization', coalesce(civilization,''),
    'lyrics', coalesce(lyrics_preview,''), 'sub', coalesce(subtitle_take1_json_url,''),
    'sub2', coalesce(subtitle_take2_json_url,''),
    'ntracks', (SELECT count(*) FROM work_language_tracks t WHERE t.work_id = user_works.id)
  ))
  FROM user_works
  WHERE id IN ('e84a86a7-6bd3-43f2-aeba-fd9878a00c93','0b3f51de-07f8-4c8f-97f2-c7634121a3ca')
) z;
