use std::env;

use tch::Device;

pub struct DDPContext {
    pub rank: i64,
    pub world_size: i64,
    pub device: Device,
}

pub fn init_ddp() -> DDPContext {
    let rank: i64 = env::var("RANK")
        .unwrap_or_else(|_| "0".into())
        .parse()
        .unwrap_or(0);
    let world_size: i64 = env::var("WORLD_SIZE")
        .unwrap_or_else(|_| "1".into())
        .parse()
        .unwrap_or(1);

    let device = if tch::Cuda::is_available() {
        Device::Cuda(rank as usize)
    } else {
        Device::Cpu
    };

    println!("DDP init rank {} / {}", rank, world_size);

    DDPContext {
        rank,
        world_size,
        device,
    }
}
