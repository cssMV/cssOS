use crate::media::runtime::exec_cmd_in_dir;

pub fn run(cmd: &str, cwd: Option<&std::path::Path>) -> anyhow::Result<()> {
    println!("cssMV render engine");
    exec_cmd_in_dir(cmd, cwd)
}
