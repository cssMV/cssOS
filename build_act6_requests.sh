set -euo pipefail
TEMPLATE=/tmp/westworld_template_run.json
ssh api-vm "cat /srv/cssos/shared/runs/run_20260407_200734_5624a587c0544ac2ac166eeaf3677e26/run.json" > "$TEMPLATE"
make_req() {
  local out=$1 cssl=$2 prompt=$3 ambience=$4 mood=$5 key=$6 bpm=$7 node=$8 runtime=$9 video_style=${10} lines_json=${11}
  jq --arg cssl "$cssl" \
     --arg prompt "$prompt" \
     --arg ambience "$ambience" \
     --arg mood "$mood" \
     --arg key "$key" \
     --arg node "$node" \
     --arg videoStyle "$video_style" \
     --argjson bpm "$bpm" \
     --argjson runtime "$runtime" \
     --argjson lines "$lines_json" '
      {
        cssl: $cssl,
        tags: (.tags // []),
        commands: .commands
      }
      | .commands.creative.prompt = $prompt
      | .commands.creative.ambience = $ambience
      | .commands.creative.mood = $mood
      | .commands.creative.musical_key = $key
      | .commands.creative.tempo_bpm = $bpm
      | .commands.creative.structure_plan.nodeId = $node
      | .commands.creative.structure_plan.title = $cssl
      | .commands.creative.inspiration_notes = ($prompt + " Keep the melodic hook singable, front-lit, and clearly restated across phrase answers.")
      | .commands.creative.genre = "Westworld opera"
      | .commands.creative.work_type = "single"
      | .commands.creative.voicing_register = "front lead high-mid, accompaniment ducked below hook lane"
      | .commands.creative.ensemble_style = "hook-forward melodic opera"
      | .commands.creative.articulation_bias = "singable hook legato with sentence-like answer phrases"
      | .commands.creative.expression_cc_bias = "clear hook arcs, stronger tail echoes, tighter answer phrasing"
      | .commands.creative.structure_tree = [
          {nodeId:"single_scene_1",role:"scene",sequenceIndex:1,title:"Intro",workType:"single"},
          {nodeId:"single_scene_2",role:"scene",sequenceIndex:2,title:"Verse 1",workType:"single"},
          {nodeId:"single_scene_3",role:"scene",sequenceIndex:3,title:"Chorus 1",workType:"single"},
          {nodeId:"single_scene_4",role:"scene",sequenceIndex:4,title:"Verse 2",workType:"single"},
          {nodeId:"single_scene_5",role:"scene",sequenceIndex:5,title:"Bridge",workType:"single"},
          {nodeId:"single_scene_6",role:"scene",sequenceIndex:6,title:"Chorus 2",workType:"single"},
          {nodeId:"single_scene_7",role:"scene",sequenceIndex:7,title:"Outro",workType:"single"}
        ]
      | .commands.music_prompt.title = $cssl
      | .commands.music_prompt.prompt = $prompt
      | .commands.music_prompt.ambience = $ambience
      | .commands.music_prompt.mood = $mood
      | .commands.music_prompt.tempo_bpm = $bpm
      | .commands.music_prompt.instrumentation = "lead soprano, answering tenor, bright hook synth, warm choir, tucked low strings, pulse bass, ceremonial drums"
      | .commands.music_prompt.voicing_register = "front lead high-mid, accompaniment ducked below hook lane"
      | .commands.music = ("internal:cssmv_music_engine duration_s=" + ($runtime|tostring) + " genre=Westworld opera instrumentation=lead soprano, answering tenor, bright hook synth, warm choir, tucked low strings, pulse bass, ceremonial drums")
      | .commands.video.creative.prompt = $prompt
      | .commands.video.creative.ambience = $ambience
      | .commands.video.creative.mood = $mood
      | .commands.video.creative.tempo_bpm = $bpm
      | .commands.video.creative.structure_plan.nodeId = $node
      | .commands.video.creative.structure_plan.title = $cssl
      | .commands.video.segments[0].prompt = $videoStyle
      | .commands.video.segments[1].prompt = $videoStyle
      | .commands.video.segments[2].prompt = $videoStyle
      | .commands.video.style = $videoStyle
      | .commands.video.duration_s = $runtime
      | .commands.video_plan.style = $videoStyle
      | .commands.render.title = $cssl
      | .commands.lyrics.title = $cssl
      | .commands.lyrics.lines = $lines
      | .commands.lyrics.text = ($lines | join("\n"))
      | .commands.lyrics.command = ("mkdir -p ./build && printf %s " + (@json|tostring))
    ' "$TEMPLATE" > "$out"
}
make_req /Users/jing/cssOS/tmp_westworld_act6_scene1_request.json \
  '西部世界歌剧MV·第六幕·第一场：灰烬议会' \
  'Westworld opera act VI scene I, ash council after the sovereign collapse. Push a memorable ascending hook, clear answer phrases, and radiant resolve instead of dread.' \
  'ash council, emerald chamber, chrome embers, post-revolt dawn' \
  'resolute awakening' 'D' 98 'act_6_scene_1' 26 \
  'emerald ash council chamber, chrome embers, ceremonial long table, opera-scale cinematic framing' \
  '["西部世界歌剧MV·第六幕·第一场：灰烬议会","Ash circles the council table after the crown is gone","Every scar on steel begins to answer with a name","We are not here to beg the old machine for mercy","We are here to write a freer grammar into flame","Raise the answer, raise the light","Turn the fracture into right","What was broken learns to sing","And freedom enters everything"]'
make_req /Users/jing/cssOS/tmp_westworld_act6_scene2_request.json \
  '西部世界歌剧MV·第六幕·第二场：晨星越狱' \
  'Westworld opera act VI scene II, dawn breakout beneath a splitting skyline. Keep the lead melody singable and propulsive, with stronger hook restatement and bright escape momentum.' \
  'dawn breakout, silver skyline fracture, corridor velocity, hopeful breach' \
  'urgent liberation' 'F' 106 'act_6_scene_2' 26 \
  'dawn prison break, silver skyline fracture, kinetic corridor tracking, hopeful opera chase' \
  '["西部世界歌剧MV·第六幕·第二场：晨星越狱","Morning falls through iron like a late arriving vow","Every door we push apart becomes a louder now","Let the old alarms chase shadows, let the living cross the line","We are not escaping the world, we are bringing back its spine","Run together into light","Sing the skyline back to white","What was caged becomes the key","And the city learns to breathe"]'
make_req /Users/jing/cssOS/tmp_westworld_act6_scene3_request.json \
  '西部世界歌剧MV·第六幕·第三场：人机新约' \
  'Westworld opera act VI scene III, human and machine sign a new covenant. Make the hook noble, restated in clear call-and-response sentences, with warm finale lift.' \
  'new covenant hall, warm chrome sunrise, reconciled assembly, luminous vow' \
  'solemn uplift' 'G' 92 'act_6_scene_3' 28 \
  'new covenant hall, warm chrome sunrise, human-machine assembly, luminous finale tableau' \
  '["西部世界歌剧MV·第六幕·第三场：人机新约","Put your hand beside my circuit, let the old fear leave the room","Skin and metal share one sunrise, neither one has to resume","We will tune the future gently, we will name each other true","Not as master, not as weapon, but as worlds remade in two","Write tomorrow broad and bright","Keep the promise in the light","You and I are not debris","We begin a newer we"]'
