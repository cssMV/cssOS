use tch::Tensor;

pub fn average_gradients(params: &mut [Tensor], world_size: f64) {
    for param in params.iter_mut() {
        let grad = param.grad();
        if grad.defined() {
            let averaged = &grad / world_size;
            param.grad().copy_(&averaged);
        }
    }
}
