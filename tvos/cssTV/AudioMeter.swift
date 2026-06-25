// W1328 — 实时音频电平表: MTAudioProcessingTap 被动挂在音频播放器上, 采 RMS → level(0~1, 平滑)。
//   不依赖后端 vol_curve, 对所有作品都生效。器乐段小 emoji 按 level 飘多/飘少。被动采样, 不改播放。
import AVFoundation
import CoreMedia
import Combine

final class AudioMeter: ObservableObject {
    @Published var level: CGFloat = 0

    func attach(to item: AVPlayerItem) {
        guard let track = item.asset.tracks(withMediaType: .audio).first else { return }
        var callbacks = MTAudioProcessingTapCallbacks(
            version: kMTAudioProcessingTapCallbacksVersion_0,
            clientInfo: UnsafeMutableRawPointer(Unmanaged.passRetained(self).toOpaque()),
            init: tapInit, finalize: tapFinalize, prepare: nil, unprepare: nil, process: tapProcess)
        var tapOut: MTAudioProcessingTap?
        let status = MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks,
                                                kMTAudioProcessingTapCreationFlag_PostEffects, &tapOut)
        guard status == noErr, let tap = tapOut else {
            Unmanaged<AudioMeter>.fromOpaque(Unmanaged.passUnretained(self).toOpaque()).release()
            return
        }
        let params = AVMutableAudioMixInputParameters(track: track)
        params.audioTapProcessor = tap
        let mix = AVMutableAudioMix()
        mix.inputParameters = [params]
        item.audioMix = mix
    }

    fileprivate func push(_ rms: CGFloat) {
        DispatchQueue.main.async {
            self.level = self.level * 0.78 + min(1, rms * 4) * 0.22   // 平滑 + 提亮
        }
    }
}

private let tapInit: MTAudioProcessingTapInitCallback = { _, clientInfo, storageOut in
    storageOut.pointee = clientInfo
}
private let tapFinalize: MTAudioProcessingTapFinalizeCallback = { tap in
    Unmanaged<AudioMeter>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).release()
}
private let tapProcess: MTAudioProcessingTapProcessCallback = { tap, frames, _, bufferList, framesOut, flagsOut in
    let st = MTAudioProcessingTapGetSourceAudio(tap, frames, bufferList, flagsOut, nil, framesOut)
    guard st == noErr else { return }
    let meter = Unmanaged<AudioMeter>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).takeUnretainedValue()
    let abl = UnsafeMutableAudioBufferListPointer(bufferList)
    var sum: Float = 0
    var count = 0
    for buf in abl {
        guard let data = buf.mData else { continue }
        let n = Int(buf.mDataByteSize) / MemoryLayout<Float>.size
        let p = data.assumingMemoryBound(to: Float.self)
        var i = 0
        while i < n { let v = p[i]; sum += v * v; i += 1 }
        count += n
    }
    if count > 0 { meter.push(CGFloat((sum / Float(count)).squareRoot())) }
}
