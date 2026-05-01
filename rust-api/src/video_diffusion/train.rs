use anyhow::Result;
use tch::nn::OptimizerConfig;
use tch::{nn, Device, Tensor};

use crate::distributed::ddp::init_ddp;
use crate::distributed::sync::average_gradients;
use crate::eval::scorer::{evaluate_video, extract_frames};
use crate::training::curriculum::build_curriculum;
use crate::training::sampler::sample_by_stage;
use crate::training::scheduler::CurriculumScheduler;
use crate::video_diffusion::diffusion::add_noise;
use crate::video_diffusion::unet3d::UNet3D;

pub fn train() -> Result<()> {
    let device = Device::cuda_if_available();
    let vs = nn::VarStore::new(device);
    let model = UNet3D::new(&vs.root());
    let mut opt = nn::Adam::default().build(&vs, 1e-4)?;

    for step in 0..100000 {
        let video = crate::data_pipeline::train_dataset::load_training_batch_from_manifest(
            "data/manifests/train.jsonl",
            2,
        )?
        .to_device(device);
        let latent = video;
        let t: f64 = rand::random();
        let (noisy, noise) = add_noise(&latent, t);
        let t_tensor = Tensor::from(t as f32).to_device(device);
        let pred = model.forward(&noisy, &t_tensor);
        let loss = (pred - noise).pow_tensor_scalar(2).mean(tch::Kind::Float);
        opt.backward_step(&loss);

        if step % 100 == 0 {
            println!("step {} loss {:?}", step, loss.double_value(&[]));
        }
    }

    vs.save("video_diffusion.pt")?;
    Ok(())
}

pub fn sample_video(model: &UNet3D) -> Tensor {
    let device = Device::cuda_if_available();
    let mut x = Tensor::randn(&[1, 4, 16, 64, 64], (tch::Kind::Float, device));

    for i in (0..50).rev() {
        let t = i as f32 / 50.0;
        let t_tensor = Tensor::from(t).to_device(device);
        let pred = model.forward(&x, &t_tensor);
        x -= pred * 0.1;
    }

    x
}

pub fn train_distributed() -> Result<()> {
    let ctx = init_ddp();
    let vs = nn::VarStore::new(ctx.device);
    let model = UNet3D::new(&vs.root());
    let mut opt = nn::Adam::default().build(&vs, 1e-4)?;

    for step in 0..100000 {
        let video = load_sharded_batch(ctx.rank, ctx.world_size)?.to_device(ctx.device);
        let latent = video;
        let t: f64 = rand::random();
        let (noisy, noise) = add_noise(&latent, t);
        let t_tensor = Tensor::from(t as f32).to_device(ctx.device);
        let pred = model.forward(&noisy, &t_tensor);
        let loss = (pred - noise).pow_tensor_scalar(2).mean(tch::Kind::Float);

        opt.zero_grad();
        loss.backward();

        let mut params = vs.trainable_variables();
        average_gradients(&mut params, ctx.world_size as f64);
        opt.step();

        if ctx.rank == 0 && step % 100 == 0 {
            println!("step {} loss {:?}", step, loss.double_value(&[]));
        }
    }

    if ctx.rank == 0 {
        vs.save("video_diffusion_ddp.pt")?;
    }

    Ok(())
}

pub fn train_with_curriculum() -> Result<()> {
    let device = Device::cuda_if_available();
    let vs = nn::VarStore::new(device);
    let model = UNet3D::new(&vs.root());
    let mut opt = nn::Adam::default().build(&vs, 1e-4)?;
    let stages = build_curriculum();
    let mut scheduler = CurriculumScheduler::new(stages);
    let dataset =
        crate::data_pipeline::train_dataset::load_all_manifest("data/manifests/train.jsonl")?;

    for step in 0..100000 {
        let stage = scheduler.current_stage().clone();
        let stage_records = sample_by_stage(&dataset, &stage);
        let chosen_records = if stage_records.is_empty() {
            dataset.iter().take(2).cloned().collect::<Vec<_>>()
        } else {
            stage_records.into_iter().take(2).collect::<Vec<_>>()
        };

        let video = crate::data_pipeline::train_dataset::load_batch_from_records(&chosen_records)?
            .to_device(device);
        let latent = video;
        let t: f64 = rand::random();
        let (noisy, noise) = add_noise(&latent, t);
        let t_tensor = Tensor::from(t as f32).to_device(device);
        let pred = model.forward(&noisy, &t_tensor);
        let loss = (pred - noise).pow_tensor_scalar(2).mean(tch::Kind::Float);
        opt.backward_step(&loss);

        if step % 100 == 0 {
            println!(
                "[{}] step {} loss {:?}",
                stage.name,
                step,
                loss.double_value(&[])
            );
        }

        scheduler.update();
    }

    vs.save("video_diffusion_curriculum.pt")?;
    Ok(())
}

pub fn evaluate_generated_video(video_path: &str) -> Result<f32> {
    let frames = extract_frames(video_path)?;
    let eval = evaluate_video(&frames)?;
    println!(
        "eval realism={} motion={} consistency={} diversity={} total={}",
        eval.realism, eval.motion, eval.consistency, eval.diversity, eval.total
    );
    Ok(eval.total)
}

pub fn load_sharded_batch(rank: i64, world: i64) -> Result<Tensor> {
    let full = crate::data_pipeline::train_dataset::load_training_batch_from_manifest(
        "data/manifests/train.jsonl",
        world.max(1) as usize * 2,
    )?;
    let batch = full.size()[0].max(1);
    let per = (batch / world.max(1)).max(1);
    let start = (rank * per).min(batch - 1);
    let remaining = batch - start;
    let take = per.min(remaining);
    Ok(full.narrow(0, start, take))
}
