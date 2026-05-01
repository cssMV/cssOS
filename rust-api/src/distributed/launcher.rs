use std::process::Command;

pub fn launch(world_size: usize) {
    for rank in 0..world_size {
        Command::new("cargo")
            .args(["run"])
            .env("RANK", rank.to_string())
            .env("WORLD_SIZE", world_size.to_string())
            .spawn()
            .expect("failed to launch distributed worker");
    }
}
