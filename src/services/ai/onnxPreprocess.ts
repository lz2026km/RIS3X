// [v3.0.6.8-60] AI ONNX 预处理管线 (简化版)
export const INPUT_SIZE = 640;

export async function loadImageToTensor(file: File): Promise<Float32Array> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      const srcIdx = (y * INPUT_SIZE + x) * 4;
      const dstIdx = y * INPUT_SIZE + x;
      tensor[dstIdx] = (imageData.data[srcIdx] ?? 0) / 255.0;
      tensor[INPUT_SIZE * INPUT_SIZE + dstIdx] = (imageData.data[srcIdx + 1] ?? 0) / 255.0;
      tensor[2 * INPUT_SIZE * INPUT_SIZE + dstIdx] = (imageData.data[srcIdx + 2] ?? 0) / 255.0;
    }
  }
  return tensor;
}
