export CSSMV_FREE_PLUGIN_HOST="$PWD/scripts/cssmv-free-plugin-host-adapter.sh"
export CSSMV_FREE_FX_HOST="$PWD/scripts/cssmv-free-plugin-host-adapter.sh"
export CSSMV_FREE_MIX_HOST="$PWD/scripts/cssmv-free-mix-host-adapter.sh"
export CSSMV_FREE_SINGER_HOST="$PWD/scripts/cssmv-free-singer-host-adapter.sh"

# macOS local assumptions
export CSSMV_HOST_CARLA_BIN="/Applications/Carla.app/Contents/MacOS/Carla"
export CSSMV_HOST_PLUGIN_BIN="$CSSMV_HOST_CARLA_BIN"
export CSSMV_HOST_MIX_BIN="$CSSMV_HOST_CARLA_BIN"

# Stable top-level templates
export CSSMV_CARLA_INSTRUMENT_RENDER_CMD="$PWD/scripts/cssmv-carla-render-template.sh {{SESSION_MANIFEST}} {{OUTPUT_MANIFEST}} {{ARTIFACT_DIR}}"
export CSSMV_CARLA_VOCAL_FX_RENDER_CMD="$PWD/scripts/cssmv-carla-render-template.sh {{SESSION_MANIFEST}} {{OUTPUT_MANIFEST}} {{ARTIFACT_DIR}}"
export CSSMV_CARLA_MIX_RENDER_CMD="$PWD/scripts/cssmv-carla-render-template.sh {{SESSION_MANIFEST}} {{OUTPUT_MANIFEST}} {{ARTIFACT_DIR}}"
export CSSMV_DIFFSINGER_RENDER_CMD="$PWD/scripts/cssmv-diffsinger-render-template.sh {{REQUEST_MANIFEST}} {{LYRICS_INPUT}} {{OUTPUT_MANIFEST}} {{ARTIFACT_DIR}}"

# Carla session templates
export CSSMV_CARLA_INSTRUMENT_PROJECT_TEMPLATE="$HOME/.cssmv-hosts/carla/instrument-template.carxp"
export CSSMV_CARLA_VOCAL_FX_PROJECT_TEMPLATE="$HOME/.cssmv-hosts/carla/vocal-fx-template.carxp"
export CSSMV_CARLA_MIX_PROJECT_TEMPLATE="$HOME/.cssmv-hosts/carla/mix-template.carxp"
export CSSMV_CARLA_HOST_ARGS="\"{{PROJECT_FILE}}\""

# Stage hooks. Replace these with your real Carla automation/export commands.
export CSSMV_CARLA_STAGE_RENDER_CMD_INSTRUMENT="python3 \"$PWD/tools/mock_success.py\" \"{{OUTPUT_MANIFEST}}\" \"{{ARTIFACT_DIR}}\""
export CSSMV_CARLA_STAGE_RENDER_CMD_VOCAL_FX="python3 \"$PWD/tools/mock_success.py\" \"{{OUTPUT_MANIFEST}}\" \"{{ARTIFACT_DIR}}\""
export CSSMV_CARLA_STAGE_RENDER_CMD_MIX="python3 \"$PWD/tools/mock_success.py\" \"{{OUTPUT_MANIFEST}}\" \"{{ARTIFACT_DIR}}\""

# DiffSingerMiniEngine assumptions
export CSSMV_DIFFSINGER_MINI_ROOT="$HOME/.cssmv-hosts/DiffSingerMiniEngine"
export CSSMV_DIFFSINGER_PYTHON="$HOME/.pyenv/shims/python3"
export CSSMV_SINGER_BACKEND="diffsinger"
export CSSMV_DIFFSINGER_CLI_TEMPLATE="python3 \"$PWD/tools/mock_singer_success.py\" \"{{OUTPUT_MANIFEST}}\" \"{{ARTIFACT_DIR}}\""
export CSSMV_SINGER_GENERIC_RENDER_CMD="$CSSMV_DIFFSINGER_CLI_TEMPLATE"
# Optional local OpenUtau handoff once a project or CLI wrapper exists.
# export CSSMV_OPENUTAU_RENDER_CMD="openutau-render --req \"{{REQUEST_MANIFEST}}\" --lyrics \"{{LYRICS_INPUT}}\" --outputs \"{{OUTPUT_MANIFEST}}\" --artifact-dir \"{{ARTIFACT_DIR}}\""
# Optional local ENUNU / NNSVS / WORLD handoff once wrappers exist.
# export CSSMV_ENUNU_RENDER_CMD="enunu-render --req \"{{REQUEST_MANIFEST}}\" --lyrics \"{{LYRICS_INPUT}}\" --outputs \"{{OUTPUT_MANIFEST}}\" --artifact-dir \"{{ARTIFACT_DIR}}\""
# export CSSMV_NNSVS_RENDER_CMD="nnsvs-render --req \"{{REQUEST_MANIFEST}}\" --lyrics \"{{LYRICS_INPUT}}\" --outputs \"{{OUTPUT_MANIFEST}}\" --artifact-dir \"{{ARTIFACT_DIR}}\""
# export CSSMV_WORLD_RENDER_CMD="world-render --req \"{{REQUEST_MANIFEST}}\" --lyrics \"{{LYRICS_INPUT}}\" --outputs \"{{OUTPUT_MANIFEST}}\" --artifact-dir \"{{ARTIFACT_DIR}}\""
export CSSMV_DIFFSINGER_LEGACY_WAV_PATH="vocal.lead.wav"
# Optional local post-mel handoff once a real vocoder is installed.
# export CSSMV_DIFFSINGER_LEGACY_VOCODER_CMD="$HOME/.pyenv/shims/python3 \"$PWD/scripts/cssmv-diffsinger-vocode-mel.py\" {{MEL_NPY}} {{SUBMIT_REQUEST}} {{OUTPUT_WAV}}"
# Dev smoke only. Remove this in real deployments so the adapter checks the actual runtime.
export CSSMV_DIFFSINGER_SKIP_ONNXRUNTIME_CHECK="1"
