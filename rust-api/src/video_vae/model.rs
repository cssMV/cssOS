use tch::{nn, Tensor};

pub struct VideoVAE {
    pub encoder: nn::Sequential,
    pub decoder: nn::Sequential,
}

impl VideoVAE {
    pub fn new(vs: &nn::Path<'_>) -> Self {
        let encoder = nn::seq()
            .add(nn::conv3d(vs, 3, 32, 3, Default::default()))
            .add_fn(|x| x.relu())
            .add(nn::conv3d(vs, 32, 64, 3, Default::default()))
            .add_fn(|x| x.relu())
            .add(nn::conv3d(vs, 64, 128, 3, Default::default()));

        let decoder = nn::seq()
            .add(nn::conv_transpose3d(vs, 128, 64, 3, Default::default()))
            .add_fn(|x| x.relu())
            .add(nn::conv_transpose3d(vs, 64, 32, 3, Default::default()))
            .add_fn(|x| x.relu())
            .add(nn::conv_transpose3d(vs, 32, 3, 3, Default::default()));

        Self { encoder, decoder }
    }

    pub fn encode(&self, x: &Tensor) -> Tensor {
        x.apply(&self.encoder)
    }

    pub fn decode(&self, z: &Tensor) -> Tensor {
        z.apply(&self.decoder)
    }
}
