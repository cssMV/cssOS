use ndarray::Array2;

pub fn build_positional_encoding(n: usize, dim: usize) -> Array2<f32> {
    let mut pe = Array2::zeros((n, dim));
    for i in 0..n {
        for j in 0..dim {
            let div = (10000.0_f32).powf((2 * (j / 2)) as f32 / dim.max(1) as f32);
            if j % 2 == 0 {
                pe[[i, j]] = (i as f32 / div).sin();
            } else {
                pe[[i, j]] = (i as f32 / div).cos();
            }
        }
    }
    pe
}
