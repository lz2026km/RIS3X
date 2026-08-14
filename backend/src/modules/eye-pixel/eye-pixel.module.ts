import { Module } from '@nestjs/common'
import { EyePixelController } from './eye-pixel.controller'
import { EyePixelService } from './eye-pixel.service'

/**
 * [G005 Wave 10A] 眼科像素级图像处理模块
 * /eye/pixel/*: histogram / colormap / instance / sharpness / mpr / artifact
 */
@Module({
  controllers: [EyePixelController],
  providers: [EyePixelService],
  exports: [EyePixelService],
})
export class EyePixelModule {}
