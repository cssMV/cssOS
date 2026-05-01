use tch::{nn, Tensor};

pub struct UNet3D {
    down1: nn::Conv3D,
    down2: nn::Conv3D,
    mid: nn::Conv3D,
    up1: nn::ConvTranspose3D,
    up2: nn::ConvTranspose3D,
}

impl UNet3D {
    pub fn new(vs: &nn::Path<'_>) -> Self {
        let down1 = nn::conv3d(vs, 4, 64, 3, Default::default());
        let down2 = nn::conv3d(vs, 64, 128, 3, Default::default());
        let mid = nn::conv3d(vs, 128, 256, 3, Default::default());
        let up1 = nn::conv_transpose3d(vs, 256, 128, 3, Default::default());
        let up2 = nn::conv_transpose3d(vs, 128, 4, 3, Default::default());

        Self {
            down1,
            down2,
            mid,
            up1,
            up2,
        }
    }

    pub fn forward(&self, x: &Tensor, _t: &Tensor) -> Tensor {
        let d1 = x.apply(&self.down1).relu();
        let d2 = d1.apply(&self.down2).relu();
        let mid = d2.apply(&self.mid).relu();
        let u1 = mid.apply(&self.up1).relu();
        u1.apply(&self.up2)
    }
}
